/**
 * Persists one global risk score snapshot per UTC calendar day.
 *
 * Writes happen from:
 *  1. A UTC cron job (00:05) that actually records a score (not a log-only stub)
 *  2. Catch-up on process start (covers restarts/deploys that miss midnight)
 *  3. Live country-risk refreshes (idempotent upsert of "today")
 *
 * Missing days are never interpolated. Headline backfill only inserts days that
 * have real article timestamps.
 */

import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { fetchHeadlines } from './newsApi.js';

export type SnapshotSource = 'live' | 'headline-backfill';

export interface TrendSnapshot {
  date: string; // YYYY-MM-DD in UTC
  score: number;
  source: SnapshotSource;
  recordedAt?: string;
}

export interface TrendPoint {
  day: string;
  date: string;
  score: number | null;
  source: SnapshotSource | 'gap';
}

const CACHE_FILE = path.join(process.cwd(), '.cache', 'global-risk-trend.json');
const WINDOW_DAYS = 30;

let scoreProvider: (() => Promise<number>) | null = null;
let cronTask: { stop: () => void } | null = null;

export function setTrendScoreProvider(fn: () => Promise<number>): void {
  scoreProvider = fn;
}

export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function formatChartDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function utcDayRange(days: number, today = utcDateKey()): string[] {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    out.push(utcDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function loadSnapshots(): TrendSnapshot[] {
  try {
    if (!fs.existsSync(CACHE_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (!Array.isArray(raw)) {
      console.error('[Dashboard] snapshot store is not an array — starting empty');
      return [];
    }
    return raw.filter(
      (s: any) => s && typeof s.date === 'string' && Number.isFinite(Number(s.score))
    );
  } catch (err) {
    console.error('[Dashboard] failed to read snapshot store', err);
    return [];
  }
}

function saveSnapshots(snapshots: TrendSnapshot[]): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = sorted.slice(-90);
  const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), 'utf-8');
  fs.renameSync(tmp, CACHE_FILE);
}

function scoreFromSentiment(sentiment: string): number {
  if (sentiment === 'negative') return 68;
  if (sentiment === 'positive') return 38;
  return 52;
}

export function hasSnapshot(date = utcDateKey()): boolean {
  return loadSnapshots().some((s) => s.date === date);
}
export function recordDailySnapshot(
  score: number,
  date = utcDateKey(),
  source: SnapshotSource = 'live'
): { date: string; score: number; action: 'insert' | 'update' } {
  const snapshots = loadSnapshots();
  const entry: TrendSnapshot = {
    date,
    score: Math.round(score),
    source,
    recordedAt: new Date().toISOString()
  };
  const idx = snapshots.findIndex((s) => s.date === date);
  if (idx >= 0) {
    snapshots[idx] = { ...snapshots[idx], ...entry };
    saveSnapshots(snapshots);
    return { date, score: entry.score, action: 'update' };
  }
  snapshots.push(entry);
  saveSnapshots(snapshots);
  return { date, score: entry.score, action: 'insert' };
}

export function deleteSnapshot(date: string): boolean {
  const snapshots = loadSnapshots();
  const next = snapshots.filter((s) => s.date !== date);
  if (next.length === snapshots.length) return false;
  saveSnapshots(next);
  return true;
}

/** Derive daily scores from headline publish dates (real RSS/API history only). */
export async function backfillTrendFromHeadlines(): Promise<number> {
  const { articles } = await fetchHeadlines('all', 100);
  const byDay = new Map<string, number[]>();

  for (const a of articles) {
    const d = new Date(a.publishedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = utcDateKey(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(scoreFromSentiment(a.sentiment));
  }

  const snapshots = loadSnapshots();
  const existing = new Set(snapshots.map((s) => s.date));
  let added = 0;

  for (const [date, scores] of byDay) {
    if (existing.has(date)) continue;
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    snapshots.push({
      date,
      score: avg,
      source: 'headline-backfill',
      recordedAt: new Date().toISOString()
    });
    existing.add(date);
    added++;
  }

  if (added > 0) saveSnapshots(snapshots);
  return added;
}

/**
 * Last N UTC calendar days. Days without a snapshot have score=null (chart gap).
 * Never copies the last known value across missing days.
 */
export function getTrendHistory(days = WINDOW_DAYS): {
  points: TrendPoint[];
  recordedCount: number;
  snapshotCount: number;
  oldestDate: string | null;
  newestDate: string | null;
  windowStart: string;
  windowEnd: string;
} {
  const snapshots = loadSnapshots();
  const byDate = new Map(snapshots.map((s) => [s.date, s]));
  const daysInWindow = utcDayRange(days);
  const windowStart = daysInWindow[0];
  const windowEnd = daysInWindow[daysInWindow.length - 1];

  const points: TrendPoint[] = daysInWindow.map((date) => {
    const hit = byDate.get(date);
    if (!hit) {
      return { day: formatChartDay(date), date, score: null, source: 'gap' };
    }
    return {
      day: formatChartDay(date),
      date,
      score: hit.score,
      source: hit.source
    };
  });

  const recorded = points.filter((p) => p.score != null);

  return {
    points,
    recordedCount: recorded.length,
    snapshotCount: snapshots.length,
    oldestDate: recorded[0]?.date ?? null,
    newestDate: recorded[recorded.length - 1]?.date ?? null,
    windowStart,
    windowEnd
  };
}

export async function runDailySnapshotJob(reason: 'cron' | 'startup' | 'manual' | 'api'): Promise<{
  ok: boolean;
  date: string;
  score?: number;
  action?: 'insert' | 'update';
  backfilled?: number;
  error?: string;
}> {
  const date = utcDateKey();
  console.log(`[Dashboard] snapshot job START reason=${reason} date=${date} tz=UTC`);
  try {
    const backfilled = await backfillTrendFromHeadlines();
    if (backfilled > 0) {
      console.log(`[Dashboard] snapshot job backfilled ${backfilled} headline-dated day(s)`);
    }

    if (!scoreProvider) {
      throw new Error('No live score provider registered');
    }
    const score = await scoreProvider();
    const result = recordDailySnapshot(score, date, 'live');
    console.log(
      `[Dashboard] snapshot job OK reason=${reason} date=${date} score=${result.score} upsert=${result.action}`
    );
    return { ok: true, date, score: result.score, action: result.action, backfilled };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Dashboard] snapshot job FAILED reason=${reason} date=${date}`, err);
    return { ok: false, date, error };
  }
}

export function initDashboardTrendService(): void {
  runDailySnapshotJob('startup').catch((err) => {
    console.error('[Dashboard] startup snapshot catch-up failed', err);
  });
}

export function startDashboardTrendCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  cronTask = cron.schedule(
    '5 0 * * *',
    () => {
      void runDailySnapshotJob('cron');
    },
    { timezone: 'UTC' }
  );
  console.log('[Dashboard] Daily snapshot cron scheduled (00:05 UTC)');
}
