/**
 * Live Alerts Center feed.
 *
 * Polls GET /api/alerts (real pipeline records) with the same safe cadence as
 * the dashboard trend hook: fetch on mount, schedule the next run only after
 * the previous one resolves, keep last data on failure, clear timers on unmount.
 *
 * A separate 30s tick only refreshes "X mins ago" labels from each alert's ISO
 * createdAt — it never refetches and never invents new rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertItem } from '../types';
import { formatRelativeTime } from './dashboardMetrics';
import {
  conditionCrossed,
  getUserAlertHits,
  getUserAlerts,
  hitToAlertItem,
  recordUserAlertHit,
  toAlertItem,
  USER_ALERTS_UPDATED_EVENT
} from './alertsService';

export const ALERTS_POLL_INTERVAL_MS = 60_000;
const RELATIVE_TICK_MS = 30_000;
const READ_KEY = 'bs-alert-read-ids';

function readReadMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {};
}

function persistReadMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

function isoOf(alert: AlertItem): string {
  return alert.createdAtIso || alert.createdAt;
}

function withRelativeTimes(alerts: AlertItem[], now: number): AlertItem[] {
  return alerts.map((a) => {
    const iso = isoOf(a);
    const label = formatRelativeTime(iso, now);
    return { ...a, createdAtIso: iso, createdAt: label || a.createdAt };
  });
}

function mergeById(rows: AlertItem[]): AlertItem[] {
  const byId = new Map<string, AlertItem>();
  for (const row of rows) {
    if (!row?.id || byId.has(row.id)) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => isoOf(b).localeCompare(isoOf(a)));
}

async function evaluateUserWatches(): Promise<AlertItem[]> {
  const watches = getUserAlerts();
  for (const watch of watches) {
    try {
      if (watch.subjectType === 'stock') {
        const res = await fetch(`/api/stocks/quote?symbol=${encodeURIComponent(watch.subject)}`, {
          cache: 'no-store'
        });
        if (!res.ok) continue;
        const quote = await res.json();
        const price = Number(quote?.price);
        if (conditionCrossed(watch, price)) recordUserAlertHit(watch, price);
      } else {
        const res = await fetch('/api/countries/risk', { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        const rows: { name?: string; riskScore?: number }[] = data?.countries || [];
        const needle = watch.subject.toLowerCase();
        const match = rows.find((r) => String(r.name || '').toLowerCase().includes(needle));
        const score = Number(match?.riskScore);
        if (conditionCrossed(watch, score)) recordUserAlertHit(watch, score);
      }
    } catch (err) {
      console.error('[Alerts] user-watch evaluation failed', watch.id, err);
    }
  }
  return getUserAlertHits().map(hitToAlertItem);
}

export function useLiveAlerts(pollIntervalMs = ALERTS_POLL_INTERVAL_MS, enabled = true) {
  const [platform, setPlatform] = useState<AlertItem[]>([]);
  const [userItems, setUserItems] = useState<AlertItem[]>(() => getUserAlerts().map(toAlertItem));
  const [hits, setHits] = useState<AlertItem[]>(() => getUserAlertHits().map(hitToAlertItem));
  const [readMap, setReadMap] = useState<Record<string, boolean>>(() => readReadMap());
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  const clearPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!mounted.current || inFlight.current || !enabled) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const incoming: AlertItem[] = Array.isArray(data?.alerts) ? data.alerts : [];
      let nextHits: AlertItem[] = getUserAlertHits().map(hitToAlertItem);
      try {
        nextHits = await evaluateUserWatches();
      } catch (err) {
        console.error('[Alerts] watch evaluation failed', err);
      }
      if (!mounted.current) return;
      setPlatform(incoming);
      setUserItems(getUserAlerts().map(toAlertItem));
      setHits(nextHits);
      setError(null);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load alerts';
      console.error('[Alerts] poll failed; keeping last known list', err);
      if (mounted.current) {
        setError(message);
        setLoading(false);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        clearPoll();
        timeoutRef.current = setTimeout(() => {
          void loadRef.current();
        }, pollIntervalMs);
      }
    }
  }, [clearPoll, pollIntervalMs, enabled]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load();
    tickRef.current = setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);
    const syncUser = () => {
      setUserItems(getUserAlerts().map(toAlertItem));
      setHits(getUserAlertHits().map(hitToAlertItem));
    };
    window.addEventListener(USER_ALERTS_UPDATED_EVENT, syncUser);
    return () => {
      mounted.current = false;
      inFlight.current = false;
      clearPoll();
      if (tickRef.current) clearInterval(tickRef.current);
      window.removeEventListener(USER_ALERTS_UPDATED_EVENT, syncUser);
    };
  }, [load, clearPoll]);

  const toggleRead = useCallback((id: string) => {
    setReadMap((prev) => {
      const current = prev[id] ?? false;
      const next = { ...prev, [id]: !current };
      persistReadMap(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids: string[]) => {
    setReadMap((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      persistReadMap(next);
      return next;
    });
  }, []);

  const alerts = useMemo(() => {
    const merged = mergeById(
      [...userItems, ...hits, ...platform].map((a) => ({
        ...a,
        read: readMap[a.id] ?? a.read ?? false
      }))
    );
    return withRelativeTimes(merged, now);
  }, [userItems, hits, platform, readMap, now]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  return {
    alerts,
    unreadCount,
    loading,
    error,
    toggleRead,
    markAllRead: () => markAllRead(alerts.map((a) => a.id)),
    refresh: () => {
      clearPoll();
      void load();
    }
  };
}
