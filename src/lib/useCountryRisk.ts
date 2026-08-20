import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveCountryRisk } from '../types';

/**
 * Single source of truth for World Risk Map auto-refresh.
 * Change this one value to retarget cadence (e.g. 24 * 60 * 60 * 1000 for daily).
 * The label is derived from the same constant so it cannot drift.
 */
export const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function formatIntervalLabel(ms: number): string {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms >= day && ms % day === 0) return `${ms / day}d`;
  if (ms >= hour && ms % hour === 0) return `${ms / hour}h`;
  const minutes = Math.max(1, Math.round(ms / minute));
  return `${minutes}m`;
}

export const AUTO_REFRESH_LABEL = formatIntervalLabel(AUTO_REFRESH_INTERVAL_MS);

export function useCountryRisk() {
  const [countries, setCountries] = useState<LiveCountryRisk[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      void loadRef.current(true);
    }, AUTO_REFRESH_INTERVAL_MS);
  }, [clearTimer]);

  const load = useCallback(async (force = false) => {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    const thisRequest = ++requestId.current;

    if (force) setRefreshing(true);

    try {
      const res = await fetch(`/api/countries/risk${force ? '?refresh=true' : ''}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Failed to load country risk');
      const data = await res.json();
      if (!mounted.current || thisRequest !== requestId.current) return;

      const nextCountries: LiveCountryRisk[] = data.countries || [];
      const changed = new Set<string>(
        nextCountries.filter((c) => c.scoreChanged).map((c) => c.id)
      );

      setCountries(nextCountries);
      // Client fetch time — not the server cache stamp — so "Updated" always moves.
      setLastUpdated(new Date().toISOString());
      setChangedIds(changed);
      setError(null);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (changed.size > 0) {
        highlightTimerRef.current = setTimeout(() => {
          if (mounted.current) setChangedIds(new Set());
        }, 4000);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Country risk unavailable';
      console.error('[World Risk Map] refresh failed:', e);
      if (mounted.current && thisRequest === requestId.current) {
        setError(message);
      }
    } finally {
      if (thisRequest === requestId.current) {
        inFlight.current = false;
      }
      if (mounted.current && thisRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        scheduleNext();
      }
    }
  }, [scheduleNext]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load(false);
    return () => {
      mounted.current = false;
      inFlight.current = false;
      requestId.current += 1;
      clearTimer();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [load, clearTimer]);

  const refresh = useCallback(() => {
    clearTimer();
    void load(true);
  }, [clearTimer, load]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    countries,
    lastUpdated,
    loading,
    refreshing,
    error,
    changedIds,
    refresh,
    dismissError
  };
}
