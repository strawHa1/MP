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
  interpolateMissingSeries,
  findTrendGaps,
  roundPercentsTo100,
  scoreDeltaFromTrend,
  trendGapCaption,
  trendYAxisDomain,
  uniqueTitles
} from '../src/lib/dashboardMetrics.ts';
import { utcDayRange, utcDateKey, formatChartDay } from '../dashboardTrendService.ts';

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

assert.equal(scoreDeltaFromTrend(60, [{ score: 50 }, { score: null }, { score: 55 }]), 5);
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

const window = utcDayRange(30, '2026-08-20');
assert.equal(window.length, 30);
assert.equal(window[0], '2026-07-22');
assert.equal(window[window.length - 1], '2026-08-20');
assert.equal(utcDateKey(new Date('2026-08-20T23:30:00Z')), '2026-08-20');
assert.equal(utcDateKey(new Date('2026-08-21T03:00:00Z')), '2026-08-20');
assert.equal(formatChartDay('2026-08-20'), 'Aug 20');

const gapped = [
  { day: 'Jul 22', date: '2026-07-22', score: null },
  { day: 'Jul 23', date: '2026-07-23', score: null },
  { day: 'Aug 10', date: '2026-08-10', score: 38 },
  { day: 'Aug 13', date: '2026-08-13', score: 39 },
  { day: 'Aug 14', date: '2026-08-14', score: null },
  { day: 'Aug 15', date: '2026-08-15', score: null },
  { day: 'Aug 16', date: '2026-08-16', score: null },
  { day: 'Aug 19', date: '2026-08-19', score: 52 },
  { day: 'Aug 20', date: '2026-08-20', score: 39 }
];
const gaps = findTrendGaps(gapped, 2);
assert.equal(gaps.length, 2);
assert.equal(gaps[0].kind, 'leading');
assert.equal(gaps[0].startKey, '2026-07-22');
assert.equal(gaps[1].kind, 'interior');
assert.equal(gaps[1].days, 3);
assert.equal(gaps[1].startIndex, 4);
assert.equal(gaps[1].endIndex, 6);
assert.equal(gaps[1].startLabel, 'Aug 14');
assert.equal(gaps[1].endLabel, 'Aug 16');
assert.deepEqual(trendGapCaption(gaps[1]), { title: 'Gap', subtitle: 'Aug 14–16' });
assert.equal(findTrendGaps(gapped, 4).length, 0);

const [yLo, yHi] = trendYAxisDomain([38, 54, 52, 39, 60]);
assert.ok(yLo <= 38);
assert.ok(yHi >= 60);
assert.ok(yHi - yLo >= 25);
assert.ok(yLo >= 0 && yHi <= 100);
assert.notDeepEqual([yLo, yHi], [0, 100]);

const tight = trendYAxisDomain([50, 52]);
assert.ok(tight[1] - tight[0] >= 25);
assert.ok(tight[0] <= 50 && tight[1] >= 52);

const floor = trendYAxisDomain([0, 2]);
assert.equal(floor[0], 0);
assert.ok(floor[1] >= 25);

assert.deepEqual(trendYAxisDomain([]), [0, 100]);

const filled = interpolateMissingSeries([10, null, null, 40]);
assert.deepEqual(filled.filled, [10, 20, 30, 40]);
assert.deepEqual(filled.estimated, [false, true, true, false]);

const lead = interpolateMissingSeries([null, null, 20, 30]);
assert.equal(lead.filled[2], 20);
assert.equal(lead.estimated[0], true);
assert.ok((lead.filled[0] as number) <= 30);

console.log('dashboardMetrics: all checks passed');
