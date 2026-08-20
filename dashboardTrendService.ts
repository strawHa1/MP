/**
 * Persists one global + country risk snapshot per America/New_York calendar day.
 *
 * Writes happen from snapshotJobService (HTTP scheduler / GitHub Actions / startup
 * catch-up / in-process backup cron). Upsert is by NY calendar date — retries never
 * duplicate a day. Missed days are recovered from dated headlines when those still
 * exist; unrecoverable days stay gaps (no interpolation).
 *
 * Weekends and holidays still record: geopolitical/news risk does not pause.
 */

import fs from 'fs';
import path from 'path';
import { fetchHeadlines } from './newsApi.js';
import { interpolateMissingSeries } from './src/lib/dashboardMetrics.js';

export type SnapshotSource = 'live' | 'headline-backfill' | 'estimated';

export interface TrendSnapshot {
  date: string; // YYYY-MM-DD America/New_York calendar day
  score: number;
  source: SnapshotSource;
  recordedAt?: string;
}

export interface TrendPoint {
  day: string;
  date: string;
  score: number | null;
  recordedScore: number | null;
  source: SnapshotSource | 'gap';
}

const WINDOW_DAYS = 30;
export const CATCHUP_LOOKBACK_DAYS = 7;

function cacheDir(): string {
  return process.env.SNAPSHOT_CACHE_DIR || path.join(process.cwd(), '.cache');
}

function cacheFilePath(): string {
  return path.join(cacheDir(), 'global-risk-trend.json');
}

function countryCacheFilePath(): string {
  return path.join(cacheDir(), 'country-risk-history.json');
}

let scoreProvider: (() => Promise<number>) | null = null;

export function setTrendScoreProvider(fn: () => Promise<number>): void {
  scoreProvider = fn;
}

export const SNAPSHOT_TZ = 'America/New_York';

/** YYYY-MM-DD in America/New_York (US equity market calendar). */
export function marketDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** @deprecated alias — snapshot keys are NY market dates, not UTC. */
export function utcDateKey(d = new Date()): string {
  return marketDateKey(d);
}

export function formatChartDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function utcDayRange(days: number, today = marketDateKey()): string[] {
  const end = new Date(`${today}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function loadSnapshots(): TrendSnapshot[] {
  try {
    if (!fs.existsSync(cacheFilePath())) return [];
    const raw = JSON.parse(fs.readFileSync(cacheFilePath(), 'utf-8'));
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
  const dir = path.dirname(cacheFilePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = sorted.slice(-90);
  const tmp = `${cacheFilePath()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), 'utf-8');
  fs.renameSync(tmp, cacheFilePath());
}

function scoreFromSentiment(sentiment: string): number {
  if (sentiment === 'negative') return 68;
  if (sentiment === 'positive') return 38;
  return 52;
}

export function hasSnapshot(date = utcDateKey()): boolean {
  return loadSnapshots().some((s) => s.date === date && s.source !== 'estimated');
}

export function listMissingRecordedDates(
  lookback = CATCHUP_LOOKBACK_DAYS,
  today = marketDateKey()
): string[] {
  const window = utcDayRange(lookback, today);
  const recorded = loadSnapshots()
    .filter((s) => s.source !== 'estimated')
    .map((s) => s.date)
    .sort();
  const have = new Set(recorded);
  const first = recorded[0];
  return window.filter((d) => {
    if (have.has(d)) return false;
    if (!first) return d === today;
    return d >= first;
  });
}

export async function headlineScoresByDate(): Promise<Map<string, number>> {
  const testRaw = process.env.SNAPSHOT_TEST_HEADLINE_SCORES;
  if (testRaw) {
    const obj = JSON.parse(testRaw) as Record<string, number>;
    return new Map(
      Object.entries(obj).map(([date, score]) => [date, Math.round(Number(score))])
    );
  }
  const { articles } = await fetchHeadlines('all', 200);
  const byDay = new Map<string, number[]>();
  for (const a of articles) {
    const d = new Date(a.publishedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = utcDateKey(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(scoreFromSentiment(a.sentiment));
  }
  const out = new Map<string, number>();
  for (const [date, scores] of byDay) {
    out.set(date, Math.round(scores.reduce((s, v) => s + v, 0) / scores.length));
  }
  return out;
}

export function getTrendScoreProvider(): (() => Promise<number>) | null {
  return scoreProvider;
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
  const byDay = await headlineScoresByDate();
  const snapshots = loadSnapshots();
  const existing = new Set(snapshots.filter((s) => s.source !== 'estimated').map((s) => s.date));
  let added = 0;

  for (const [date, score] of byDay) {
    if (existing.has(date)) continue;
    snapshots.push({
      date,
      score,
      source: 'headline-backfill',
      recordedAt: new Date().toISOString()
    });
    existing.add(date);
    added++;
  }

  if (added > 0) saveSnapshots(snapshots);
  return added;
}

const RECORDED_SOURCES = new Set<SnapshotSource>(['live', 'headline-backfill']);

export function refreshEstimatedSnapshots(days = WINDOW_DAYS): number {
  const daysInWindow = utcDayRange(days);
  const snapshots = loadSnapshots().filter((s) => s.source !== 'estimated');
  const byDate = new Map(snapshots.map((s) => [s.date, s]));
  const series = daysInWindow.map((d) => {
    const hit = byDate.get(d);
    return hit && RECORDED_SOURCES.has(hit.source) ? hit.score : null;
  });
  const { filled, estimated } = interpolateMissingSeries(series);
  let added = 0;
  for (let i = 0; i < daysInWindow.length; i++) {
    if (!estimated[i] || filled[i] == null) continue;
    snapshots.push({
      date: daysInWindow[i],
      score: filled[i] as number,
      source: 'estimated',
      recordedAt: new Date().toISOString()
    });
    added += 1;
  }
  saveSnapshots(snapshots);
  return added;
}

export type CountryHistoryRow = { id: string; score: number };

type CountryDayScores = Record<string, { score: number; source: SnapshotSource }>;
type CountryStore = Record<string, CountryDayScores>;

function loadCountryStore(): CountryStore {
  try {
    if (!fs.existsSync(countryCacheFilePath())) return {};
    const raw = JSON.parse(fs.readFileSync(countryCacheFilePath(), 'utf-8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (err) {
    console.error('[Dashboard] failed to read country history', err);
    return {};
  }
}

function saveCountryStore(store: CountryStore): void {
  const dir = path.dirname(countryCacheFilePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dates = Object.keys(store).sort();
  const trimmed: CountryStore = {};
  for (const date of dates.slice(-90)) trimmed[date] = store[date];
  const tmp = `${countryCacheFilePath()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), 'utf-8');
  fs.renameSync(tmp, countryCacheFilePath());
}

export function recordCountryDailySnapshot(
  rows: CountryHistoryRow[],
  date = utcDateKey(),
  source: SnapshotSource = 'live'
): void {
  if (!rows.length) return;
  const store = loadCountryStore();
  const day = { ...(store[date] || {}) };
  for (const row of rows) {
    day[row.id] = { score: Math.round(row.score), source };
  }
  store[date] = day;
  saveCountryStore(store);
}

export function refreshCountryEstimated(ids: string[], days = WINDOW_DAYS): void {
  const store = loadCountryStore();
  const dates = utcDayRange(days);
  for (const id of ids) {
    const series = dates.map((d) => {
      const cell = store[d]?.[id];
      return cell && cell.source !== 'estimated' ? cell.score : null;
    });
    const { filled, estimated } = interpolateMissingSeries(series);
    for (let i = 0; i < dates.length; i++) {
      if (!estimated[i] || filled[i] == null) continue;
      if (!store[dates[i]]) store[dates[i]] = {};
      store[dates[i]][id] = { score: filled[i] as number, source: 'estimated' };
    }
  }
  saveCountryStore(store);
}

export function getCountryHistory(days = WINDOW_DAYS): {
  date: string;
  scores: Record<string, number>;
}[] {
  const store = loadCountryStore();
  return utcDayRange(days).map((date) => {
    const day = store[date] || {};
    const scores: Record<string, number> = {};
    for (const [id, cell] of Object.entries(day)) scores[id] = cell.score;
    return { date, scores };
  });
}

let countryHistoryComputer: ((headlines: { title: string; description: string; region: 'india' | 'world'; sentiment: string; publishedAt: string }[]) => CountryHistoryRow[]) | null = null;

export function setCountryHistoryComputer(
  fn: (headlines: { title: string; description: string; region: 'india' | 'world'; sentiment: string; publishedAt: string }[]) => CountryHistoryRow[]
): void {
  countryHistoryComputer = fn;
}

export async function backfillCountryHistoryFromHeadlines(): Promise<number> {
  if (!countryHistoryComputer) return 0;
  if (process.env.SNAPSHOT_TEST_MODE === '1') return 0;
  const { articles } = await fetchHeadlines('all', 200);
  const byDay = new Map<string, typeof articles>();
  for (const a of articles) {
    const d = new Date(a.publishedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = utcDateKey(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(a);
  }
  const store = loadCountryStore();
  let added = 0;
  for (const [date, dayArticles] of byDay) {
    const existing = store[date] || {};
    const hasRecorded = Object.values(existing).some((c) => c.source !== 'estimated');
    if (hasRecorded) continue;
    const rows = countryHistoryComputer(dayArticles);
    if (!rows.length) continue;
    recordCountryDailySnapshot(rows, date, 'headline-backfill');
    added += 1;
  }
  return added;
}

/**
 * Last N UTC calendar days. Estimated days are filled and flagged; recordedCount
 * only includes live + headline-backfill rows.
 */
export function getTrendHistory(days = WINDOW_DAYS): {
  points: TrendPoint[];
  recordedCount: number;
  estimatedCount: number;
  snapshotCount: number;
  oldestDate: string | null;
  newestDate: string | null;
  windowStart: string;
  windowEnd: string;
} {
  const snapshots = loadSnapshots();
  const byDate = new Map<string, TrendSnapshot>();
  for (const s of snapshots) {
    const prev = byDate.get(s.date);
    if (!prev || (prev.source === 'estimated' && s.source !== 'estimated')) {
      byDate.set(s.date, s);
    }
  }
  const daysInWindow = utcDayRange(days);
  const windowStart = daysInWindow[0];
  const windowEnd = daysInWindow[daysInWindow.length - 1];

  const points: TrendPoint[] = daysInWindow.map((date) => {
    const hit = byDate.get(date);
    if (!hit) {
      return { day: formatChartDay(date), date, score: null, recordedScore: null, source: 'gap' };
    }
    const recorded = hit.source !== 'estimated';
    return {
      day: formatChartDay(date),
      date,
      score: hit.score,
      recordedScore: recorded ? hit.score : null,
      source: hit.source
    };
  });

  const recordedPts = points.filter((p) => p.source === 'live' || p.source === 'headline-backfill');
  const estimatedPts = points.filter((p) => p.source === 'estimated');

  return {
    points,
    recordedCount: recordedPts.length,
    estimatedCount: estimatedPts.length,
    snapshotCount: snapshots.length,
    oldestDate: recordedPts[0]?.date ?? points.find((p) => p.score != null)?.date ?? null,
    newestDate: recordedPts[recordedPts.length - 1]?.date ?? null,
    windowStart,
    windowEnd
  };
}

