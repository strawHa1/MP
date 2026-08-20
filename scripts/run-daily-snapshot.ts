/**
 * Trigger the durable daily snapshot job on a running server.
 * Used by GitHub Actions, Task Scheduler, or `npm run snapshot`.
 */
const rawBase = (process.env.APP_URL || '').trim();
const base =
  !rawBase || rawBase === 'MY_APP_URL'
    ? `http://127.0.0.1:${process.env.PORT || 3002}`
    : rawBase.replace(/\/$/, '');
const secret = (process.env.SNAPSHOT_JOB_SECRET || '').trim();
const url = `${base}/api/jobs/daily-snapshot`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(secret ? { 'x-snapshot-job-secret': secret } : {})
  }
});

const body = await res.text();
if (!res.ok) {
  console.error(`Snapshot job HTTP ${res.status} from ${url}`);
  console.error(body);
  process.exit(1);
}
console.log(body);
