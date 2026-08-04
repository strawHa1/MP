/**
 * Persists one global risk score snapshot per calendar day.
 * Backfills from live headline history where available; no synthetic/random points.
 */

import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { fetchHeadlines } from './newsApi.js';

export interface TrendSnapshot {
  date: string; // YYYY-MM-DD
  score: number;
  source: 'live' | 'headline-backfill';
}

const CACHE_FILE = path.join(process.cwd(), '.cache', 'global-risk-trend.json');

function loadSnapshots(): TrendSnapshot[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as TrendSnapshot[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveSnapshots(snapshots: TrendSnapshot[]): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = sorted.slice(-60);
  fs.writeFileSync(CACHE_FILE, JSON.stringify(trimmed, null, 2));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatChartDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function scoreFromSentiment(sentiment: string): number {
  if (sentiment === 'negative') return 68;
  if (sentiment === 'positive') return 38;
  return 52;
}

/** Upsert today's live global risk score (one row per calendar day). */
export function recordDailySnapshot(score: number): void {
  const today = isoDate(new Date());
  const snapshots = loadSnapshots();
  const idx = snapshots.findIndex((s) => s.date === today);
  const entry: TrendSnapshot = { date: today, score: Math.round(score), source: 'live' };
  if (idx >= 0) snapshots[idx] = entry;
  else snapshots.push(entry);
  saveSnapshots(snapshots);
}

/** Derive daily scores from headline publish dates (real RSS/API history only). */
export async function backfillTrendFromHeadlines(): Promise<number> {
  const { articles } = await fetchHeadlines('all', 100);
  const byDay = new Map<string, number[]>();

  for (const a of articles) {
    const d = new Date(a.publishedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = isoDate(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(scoreFromSentiment(a.sentiment));
  }

  const snapshots = loadSnapshots();
  let added = 0;

  for (const [date, scores] of byDay) {
    if (snapshots.some((s) => s.date === date)) continue;
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    snapshots.push({ date, score: avg, source: 'headline-backfill' });
    added++;
  }

  if (added > 0) saveSnapshots(snapshots);
  return added;
}

/** Last N calendar days with real snapshots only (no fabricated fill). */
export function getTrendHistory(days = 30): {
  points: { day: string; score: number; date: string; source: string }[];
  snapshotCount: number;
  oldestDate: string | null;
  newestDate: string | null;
} {
  const snapshots = loadSnapshots();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const cutoffStr = isoDate(cutoff);

  const inRange = snapshots
    .filter((s) => s.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const points = inRange.map((s) => ({
    day: formatChartDay(s.date),
    score: s.score,
    date: s.date,
    source: s.source
  }));

  return {
    points,
    snapshotCount: snapshots.length,
    oldestDate: inRange[0]?.date ?? null,
    newestDate: inRange[inRange.length - 1]?.date ?? null
  };
}

export function initDashboardTrendService(): void {
  backfillTrendFromHeadlines()
    .then((n) => {
      if (n > 0) console.log(`[Dashboard] Backfilled ${n} trend day(s) from headline history`);
    })
    .catch(console.error);
}

export function startDashboardTrendCron(): void {
  cron.schedule('5 0 * * *', () => {
    console.log('[Dashboard] Daily trend snapshot cron (placeholder — score recorded on API refresh)');
  });
}
