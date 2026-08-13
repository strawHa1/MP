/**
 * Critical dashboard calculation checks (run: npx tsx scripts/test-dashboard-metrics.ts)
 */
import assert from 'node:assert/strict';
import {
  computeSentiment,
  displayCountryName,
  impactScoreFromSeverity,
  isBlackSwanEvent,
  isHeadlineLive,
  isImpactAligned,
  roundPercentsTo100,
  scoreDeltaFromTrend,
  uniqueTitles
} from '../src/lib/dashboardMetrics.ts';

assert.equal(displayCountryName('United States'), 'USA');
assert.equal(displayCountryName('United Kingdom'), 'UK');
assert.equal(displayCountryName('India'), 'India');
assert.notEqual(displayCountryName('United States').split(' ')[0], 'United');

const [b, n, p] = roundPercentsTo100([1, 1, 1]);
assert.equal(b + n + p, 100);

const sentiment = computeSentiment([
  { sentiment: 'negative' },
  { sentiment: 'negative' },
  { sentiment: 'neutral' }
]);
assert.equal(sentiment.bearishPct + sentiment.neutralPct + sentiment.bullishPct, 100);

assert.equal(isBlackSwanEvent({ severity: 'medium', impactScore: 90 }), false);
assert.equal(isBlackSwanEvent({ severity: 'high', impactScore: 70 }), false);
assert.equal(isBlackSwanEvent({ severity: 'high', impactScore: 80 }), true);
assert.equal(isBlackSwanEvent({ severity: 'critical', impactScore: 40 }), true);

assert.equal(isImpactAligned(-1.2, -3, -0.5), true);
assert.equal(isImpactAligned(4, -3, -0.5), false);
assert.equal(isImpactAligned(1.0, 0.8, 1.4), true);

assert.equal(scoreDeltaFromTrend(60, [{ score: 50 }, { score: 55 }]), 5);
assert.equal(scoreDeltaFromTrend(60, [{ score: 50 }, { score: 60 }]), 10);
assert.equal(scoreDeltaFromTrend(60, [{ score: 60 }]), null);

assert.equal(isHeadlineLive(new Date().toISOString()), true);
assert.equal(isHeadlineLive(new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()), false);

assert.equal(impactScoreFromSeverity('critical'), 88);

const deduped = uniqueTitles([
  { title: 'Same Event' },
  { title: 'same event' },
  { title: 'Other' }
]);
assert.equal(deduped.length, 2);

console.log('dashboardMetrics: all checks passed');
