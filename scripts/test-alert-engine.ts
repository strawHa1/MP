/**
 * Alert engine checks (run: npx tsx scripts/test-alert-engine.ts)
 */
import assert from 'node:assert/strict';
import {
  alertFromHeadline,
  alertFromImpact,
  alertsFromCountryRisk,
  upsertAlerts,
  type StoredAlert
} from '../src/lib/alertEngine.ts';
import { formatRelativeTime } from '../src/lib/dashboardMetrics.ts';
import { conditionCrossed, type UserAlert } from '../src/lib/alertsService.ts';

const now = Date.parse('2026-08-20T12:00:00Z');
assert.equal(formatRelativeTime('2026-08-20T11:59:30Z', now), 'Just now');
assert.equal(formatRelativeTime('2026-08-20T11:40:00Z', now), '20 mins ago');
assert.equal(formatRelativeTime('2026-08-20T10:00:00Z', now), '2 hrs ago');

const impact = alertFromImpact({
  id: 'abc',
  ticker: 'NVDA',
  headline: 'Export controls hit GPU shipments',
  description: 'New license rules.',
  severity: 'high',
  publishedAt: '2026-08-20T10:00:00Z',
  sector: 'Semiconductors',
  projectedImpactLabel: '-3% to -5%'
});
assert.ok(impact);
assert.equal(impact!.id, 'impact:abc');

const skippedMedium = alertFromImpact({
  id: 'med',
  ticker: 'AAPL',
  headline: 'Routine update',
  severity: 'medium',
  publishedAt: '2026-08-20T10:00:00Z'
});
assert.equal(skippedMedium, null);

const headline = alertFromHeadline({
  id: 'h1',
  title: 'Declaration of war raises market collapse fears',
  description: 'Markets react.',
  sentiment: 'negative',
  publishedAt: '2026-08-20T09:00:00Z'
});
assert.ok(headline);
assert.equal(headline!.id, 'headline:h1');

const noisy = alertFromHeadline({
  id: 'h2',
  title: 'Chip maker misses estimates',
  description: 'Quarterly results.',
  sentiment: 'negative',
  publishedAt: '2026-08-20T09:00:00Z'
});
assert.equal(noisy, null);

const country = alertsFromCountryRisk([
  { id: 'tw', name: 'Taiwan', riskScore: 88, scoreChanged: true, previousScore: 70 },
  { id: 'us', name: 'United States', riskScore: 40, scoreChanged: true },
  { id: 'in', name: 'India', riskScore: 80, scoreChanged: false }
]);
assert.equal(country.length, 1);
assert.ok(country[0].id.startsWith('country:tw:'));

const first: StoredAlert = { ...impact!, createdAt: '2026-08-20T10:00:00Z' };
const updated = upsertAlerts([first], [
  { ...first, title: 'UPDATED title', createdAt: '2026-08-20T12:00:00Z' }
]);
assert.equal(updated.length, 1);
assert.equal(updated[0].createdAt, '2026-08-20T10:00:00Z');
assert.equal(updated[0].title, 'UPDATED title');

const two = upsertAlerts(updated, [
  {
    id: 'impact:xyz',
    title: 'Second',
    severity: 'critical',
    message: 'm',
    createdAt: '2026-08-20T11:00:00Z',
    category: 'Energy',
    source: 'impact'
  }
]);
assert.equal(two.length, 2);
assert.equal(new Set(two.map((a) => a.id)).size, 2);

const watch: UserAlert = {
  id: 'ua-1',
  subject: 'NVDA',
  subjectType: 'stock',
  condition: 'price_below',
  threshold: 150,
  createdAt: '2026-08-20T00:00:00Z',
  triggered: false
};
assert.equal(conditionCrossed(watch, 140), true);
assert.equal(conditionCrossed(watch, 160), false);

console.log('alert-engine tests passed');
