/**
 * Evaluates live impact / headline / country-risk signals and persists alert
 * records. Upsert is by stable id so retries and polls never duplicate a day.
 */

import fs from 'fs';
import path from 'path';
import { fetchHeadlines } from './newsApi.js';
import { getImpactState, refreshImpactData } from './impactService.js';
import { getLiveCountryRisk } from './marketDataService.js';
import {
  alertsFromCountryRisk,
  alertsFromHeadlines,
  alertsFromImpactRecords,
  storedAlertToItem,
  upsertAlerts,
  type StoredAlert
} from './src/lib/alertEngine.js';

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
let evalPromise: Promise<{ alerts: StoredAlert[]; generated: number }> | null = null;
let lastEvaluated: string | null = null;

function cacheDir(): string {
  return process.env.SNAPSHOT_CACHE_DIR || path.join(process.cwd(), '.cache');
}

function alertsFilePath(): string {
  return path.join(cacheDir(), 'live-alerts.json');
}

function loadAlerts(): StoredAlert[] {
  try {
    if (!fs.existsSync(alertsFilePath())) return [];
    const raw = JSON.parse(fs.readFileSync(alertsFilePath(), 'utf-8'));
    if (!Array.isArray(raw)) return [];
    return raw.filter((row) => row && typeof row.id === 'string' && typeof row.createdAt === 'string');
  } catch (err) {
    console.error('[Alerts] failed to read alert store', err);
    return [];
  }
}

function saveAlerts(alerts: StoredAlert[]): void {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${alertsFilePath()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(alerts, null, 2), 'utf-8');
  fs.renameSync(tmp, alertsFilePath());
}

function trimStale(alerts: StoredAlert[]): StoredAlert[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return alerts.filter((a) => {
    const t = new Date(a.createdAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

export async function evaluateLiveAlerts(): Promise<{ alerts: StoredAlert[]; generated: number }> {
  if (evalPromise) return evalPromise;
  evalPromise = (async () => {
    const existing = loadAlerts();
    await refreshImpactData(false);
    const impactState = getImpactState();
    const [countryData, headlines] = await Promise.all([
      getLiveCountryRisk(false),
      fetchHeadlines('all', 40)
    ]);

    const incoming = [
      ...alertsFromImpactRecords(impactState.impactedCompanies || []),
      ...alertsFromHeadlines(headlines.articles || []),
      ...alertsFromCountryRisk(countryData?.countries || [])
    ];

    const existingIds = new Set(existing.map((a) => a.id));
    const generated = incoming.filter((a) => !existingIds.has(a.id)).length;
    const next = trimStale(upsertAlerts(existing, incoming));
    saveAlerts(next);
    lastEvaluated = new Date().toISOString();
    if (generated > 0) {
      console.log(`[Alerts] recorded ${generated} new live alert(s); store=${next.length}`);
    }
    return { alerts: next, generated };
  })().finally(() => {
    evalPromise = null;
  });
  return evalPromise;
}

export function listStoredAlerts(): StoredAlert[] {
  return loadAlerts();
}

export async function getLiveAlertsPayload() {
  const { alerts } = await evaluateLiveAlerts();
  return {
    alerts: alerts.map((row) => storedAlertToItem(row, false)),
    lastEvaluated,
    count: alerts.length
  };
}

export function startAlertEngine(): void {
  const tick = async () => {
    try {
      await evaluateLiveAlerts();
    } catch (err) {
      console.error('[Alerts] evaluation failed', err);
    } finally {
      setTimeout(tick, 120_000);
    }
  };
  void tick();
  console.log('[Alerts] live alert engine started (evaluates impact/headline/country signals every 2 min)');
}
