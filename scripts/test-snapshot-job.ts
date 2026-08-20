/**
 * Daily snapshot job checks (run: npx tsx scripts/test-snapshot-job.ts)
 *
 * Uses an isolated SNAPSHOT_CACHE_DIR so it never touches the live .cache store.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-job-'));
process.env.SNAPSHOT_CACHE_DIR = cacheDir;
process.env.SNAPSHOT_TEST_MODE = '1';
process.env.SNAPSHOT_RETRY_DELAYS_MS = '1,1,1';
delete process.env.SNAPSHOT_ALERT_WEBHOOK;

const {
  CATCHUP_LOOKBACK_DAYS,
  deleteSnapshot,
  listMissingRecordedDates,
  marketDateKey,
  recordDailySnapshot,
  setTrendScoreProvider,
  utcDayRange
} = await import('../dashboardTrendService.ts');
const { recoverMissingDays, runDailySnapshotJob, withRetries } = await import(
  '../snapshotJobService.ts'
);

function shiftDay(today: string, delta: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function loadStore(): { date: string; source: string; score: number }[] {
  const file = path.join(cacheDir, 'global-risk-trend.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function datesOnly(rows: { date: string }[]): string[] {
  return [...rows.map((r) => r.date)].sort();
}

let attempts = 0;
const retried = await withRetries(async () => {
  attempts += 1;
  if (attempts === 1) throw new Error('simulated transient failure');
  return 'ok';
});
assert.equal(retried, 'ok');
assert.equal(attempts, 2);

const today = marketDateKey();
const yesterday = shiftDay(today, -1);
const first = shiftDay(today, -6);
const unrecoverable = shiftDay(today, -4);

recordDailySnapshot(40, first, 'live');
assert.ok(listMissingRecordedDates(CATCHUP_LOOKBACK_DAYS, today).includes(yesterday));

process.env.SNAPSHOT_TEST_HEADLINE_SCORES = JSON.stringify({ [yesterday]: 57 });

const catchUp = await recoverMissingDays();
assert.deepEqual(catchUp.recovered, [yesterday]);
assert.ok(catchUp.unrecoverable.includes(unrecoverable));
assert.equal(loadStore().filter((r) => r.date === yesterday).length, 1);
assert.equal(loadStore().find((r) => r.date === yesterday)?.source, 'headline-backfill');

deleteSnapshot(yesterday);
assert.equal(loadStore().filter((r) => r.date === yesterday).length, 0);

let failOnce = true;
setTrendScoreProvider(async () => {
  if (failOnce) {
    failOnce = false;
    throw new Error('simulated transient failure');
  }
  return 41;
});

const firstRun = await runDailySnapshotJob('manual');
assert.equal(firstRun.ok, true);
assert.equal(firstRun.score, 41);
assert.ok(firstRun.unrecoverableDays?.includes(unrecoverable));

const afterFirst = loadStore().filter((r) => r.source !== 'estimated');
assert.equal(afterFirst.filter((r) => r.date === today).length, 1);
assert.equal(afterFirst.filter((r) => r.date === yesterday).length, 1);
assert.equal(new Set(datesOnly(afterFirst)).size, afterFirst.length);

const secondRun = await runDailySnapshotJob('manual');
assert.equal(secondRun.ok, true);
assert.equal(secondRun.action, 'update');
const afterSecond = loadStore().filter((r) => r.source !== 'estimated');
assert.equal(afterSecond.filter((r) => r.date === today).length, 1);
assert.equal(new Set(datesOnly(afterSecond)).size, afterSecond.length);

const window = utcDayRange(7, today);
assert.equal(window[window.length - 1], today);

fs.rmSync(cacheDir, { recursive: true, force: true });
console.log('snapshot-job tests passed');
