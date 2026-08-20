/**
 * Self-sustaining daily snapshot runner: retries, catch-up of real recoverable
 * days, health persistence, and optional webhook alerts.
 *
 * Durable triggers (survive process death):
 *  1. POST /api/jobs/daily-snapshot — GitHub Actions, OS Task Scheduler, curl
 *  2. Startup catch-up when the Node process comes back
 * In-process node-cron is a backup only while the server stays up.
 *
 * Catch-up never interpolates. Missing days are recovered from dated headlines
 * when that source still has them; otherwise they stay gaps and are alerted.
 */

import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import {
  CATCHUP_LOOKBACK_DAYS,
  SNAPSHOT_TZ,
  backfillCountryHistoryFromHeadlines,
  backfillTrendFromHeadlines,
  getTrendScoreProvider,
  hasSnapshot,
  headlineScoresByDate,
  listMissingRecordedDates,
  marketDateKey,
  recordDailySnapshot
} from './dashboardTrendService.js';

export interface SnapshotJobHealth {
  ok: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastSuccessDate: string | null;
  lastError: string | null;
  lastReason: string | null;
  attempts: number;
  recoveredDays: string[];
  unrecoverableDays: string[];
  tz: string;
}

let cronTask: { stop: () => void } | null = null;

function cacheDir(): string {
  return process.env.SNAPSHOT_CACHE_DIR || path.join(process.cwd(), '.cache');
}

function healthFilePath(): string {
  return path.join(cacheDir(), 'snapshot-job-health.json');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseRetryDelaysMs(reason?: string): number[] {
  const scheduled = reason === 'scheduler' || reason === 'cron';
  const raw =
    process.env.SNAPSHOT_RETRY_DELAYS_MS ||
    (scheduled ? '120000,300000,600000' : '2000,8000,20000');
  const parsed = raw
    .split(',')
    .map((s) => Math.max(0, Number.parseInt(s.trim(), 10)))
    .filter((n) => Number.isFinite(n));
  if (parsed.length > 0) return parsed.slice(0, 5);
  return scheduled ? [120000, 300000, 600000] : [2000, 8000, 20000];
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  attempts = 3,
  reason?: string
): Promise<T> {
  const delays = parseRetryDelaysMs(reason);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`[Dashboard] snapshot attempt ${i + 1}/${attempts} failed`, err);
      if (i < attempts - 1) {
        const wait = delays[Math.min(i, delays.length - 1)] ?? 2000;
        await sleep(wait);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function readSnapshotJobHealth(): SnapshotJobHealth {
  try {
    if (!fs.existsSync(healthFilePath())) {
      return emptyHealth();
    }
    const raw = JSON.parse(fs.readFileSync(healthFilePath(), 'utf-8'));
    return { ...emptyHealth(), ...raw };
  } catch {
    return emptyHealth();
  }
}

function emptyHealth(): SnapshotJobHealth {
  return {
    ok: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastSuccessDate: null,
    lastError: null,
    lastReason: null,
    attempts: 0,
    recoveredDays: [],
    unrecoverableDays: [],
    tz: SNAPSHOT_TZ
  };
}

function writeHealth(health: SnapshotJobHealth): void {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${healthFilePath()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(health, null, 2), 'utf-8');
  fs.renameSync(tmp, healthFilePath());
}

export async function emitSnapshotAlert(payload: {
  date: string;
  error: string;
  reason: string;
  unrecoverableDays?: string[];
}): Promise<void> {
  const event = {
    type: 'snapshot_job_failed',
    tz: SNAPSHOT_TZ,
    at: new Date().toISOString(),
    ...payload
  };
  console.error('[SNAPSHOT_ALERT]', JSON.stringify(event));
  const url = (process.env.SNAPSHOT_ALERT_WEBHOOK || '').trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    console.error('[Dashboard] snapshot alert webhook failed', err);
  }
}

/**
 * Recover missed days from dated headlines only — never interpolates.
 * Days with no remaining source data stay gaps and are returned as unrecoverable.
 */
export async function recoverMissingDays(
  lookback = CATCHUP_LOOKBACK_DAYS
): Promise<{ recovered: string[]; unrecoverable: string[] }> {
  const today = marketDateKey();
  const missing = listMissingRecordedDates(lookback, today).filter((d) => d !== today);
  if (missing.length === 0) return { recovered: [], unrecoverable: [] };

  const byDay = await headlineScoresByDate();
  const recovered: string[] = [];
  const unrecoverable: string[] = [];

  for (const date of missing) {
    const score = byDay.get(date);
    if (score == null) {
      unrecoverable.push(date);
      continue;
    }
    recordDailySnapshot(score, date, 'headline-backfill');
    recovered.push(date);
  }
  return { recovered, unrecoverable };
}

export async function runDailySnapshotJob(
  reason: 'cron' | 'startup' | 'manual' | 'api' | 'scheduler'
): Promise<{
  ok: boolean;
  date: string;
  score?: number;
  action?: 'insert' | 'update';
  backfilled?: number;
  recoveredDays?: string[];
  unrecoverableDays?: string[];
  attempts?: number;
  error?: string;
}> {
  const date = marketDateKey();
  const attempts = 3;
  console.log(`[Dashboard] snapshot job START reason=${reason} date=${date} tz=${SNAPSHOT_TZ}`);

  const prior = readSnapshotJobHealth();
  writeHealth({
    ...prior,
    lastAttemptAt: new Date().toISOString(),
    lastReason: reason,
    tz: SNAPSHOT_TZ
  });

  try {
    const result = await withRetries(async () => {
      const backfilled = await backfillTrendFromHeadlines();
      if (backfilled > 0) {
        console.log(`[Dashboard] snapshot job backfilled ${backfilled} headline-dated day(s)`);
      }

      const catchUp = await recoverMissingDays();
      if (catchUp.recovered.length > 0) {
        console.log(`[Dashboard] snapshot catch-up recovered ${catchUp.recovered.join(', ')}`);
      }

      const provider = getTrendScoreProvider();
      if (!provider) {
        throw new Error('No live score provider registered');
      }
      const score = await provider();
      const upsert = recordDailySnapshot(score, date, 'live');

      const countryDays = await backfillCountryHistoryFromHeadlines();
      if (countryDays > 0) {
        console.log(`[Dashboard] snapshot job backfilled ${countryDays} country-history day(s)`);
      }

      return { backfilled, catchUp, upsert };
    }, attempts, reason);

    const stillMissing = listMissingRecordedDates(CATCHUP_LOOKBACK_DAYS, date).filter((d) => d !== date);
    const unrecoverableDays = result.catchUp.unrecoverable.filter((d) => stillMissing.includes(d));

    writeHealth({
      ok: true,
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastSuccessDate: date,
      lastError: unrecoverableDays.length ? `unrecoverable gaps: ${unrecoverableDays.join(', ')}` : null,
      lastReason: reason,
      attempts,
      recoveredDays: result.catchUp.recovered,
      unrecoverableDays,
      tz: SNAPSHOT_TZ
    });

    if (unrecoverableDays.length > 0) {
      await emitSnapshotAlert({
        date,
        reason,
        error: 'Catch-up could not reconstruct real data for missed day(s)',
        unrecoverableDays
      });
    }

    console.log(
      `[Dashboard] snapshot job OK reason=${reason} date=${date} tz=${SNAPSHOT_TZ} score=${result.upsert.score} upsert=${result.upsert.action}`
    );
    return {
      ok: true,
      date,
      score: result.upsert.score,
      action: result.upsert.action,
      backfilled: result.backfilled,
      recoveredDays: result.catchUp.recovered,
      unrecoverableDays,
      attempts
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    writeHealth({
      ...readSnapshotJobHealth(),
      ok: false,
      lastAttemptAt: new Date().toISOString(),
      lastError: error,
      lastReason: reason,
      attempts,
      tz: SNAPSHOT_TZ
    });
    await emitSnapshotAlert({ date, reason, error });
    console.error(`[Dashboard] snapshot job FAILED reason=${reason} date=${date}`, err);
    return { ok: false, date, error, attempts };
  }
}

export function snapshotHealthSummary(): SnapshotJobHealth & { todayHasSnapshot: boolean } {
  return {
    ...readSnapshotJobHealth(),
    todayHasSnapshot: hasSnapshot(marketDateKey())
  };
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
    '5 16 * * *',
    () => {
      void runDailySnapshotJob('cron');
    },
    { timezone: SNAPSHOT_TZ }
  );
  console.log(
    `[Dashboard] Backup in-process cron at 16:05 ${SNAPSHOT_TZ}. Durable trigger: POST /api/jobs/daily-snapshot (GitHub Actions or npm run snapshot).`
  );
}
