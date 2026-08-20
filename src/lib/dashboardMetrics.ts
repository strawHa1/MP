/**
 * Pure dashboard calculations — kept free of React/IO so they can be unit-tested.
 */

export const LIVE_FRESHNESS_MS = 3 * 60 * 1000;
export const HEADLINE_LIVE_MS = 3 * 60 * 60 * 1000;

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SentimentBreakdown {
  bearishPct: number;
  neutralPct: number;
  bullishPct: number;
  gaugeScore: number;
  label: 'Very Bearish' | 'Bearish' | 'Neutral' | 'Bullish' | 'Very Bullish' | string;
}

const COUNTRY_DISPLAY: Record<string, string> = {
  'United States': 'USA',
  'United Kingdom': 'UK',
  'Saudi Arabia': 'Saudi Arabia',
  'South Korea': 'S. Korea',
  'Oman / Strait of Hormuz': 'Hormuz'
};

/** Full names stay intact — never split "United States" into "United". */
export function displayCountryName(name: string): string {
  if (!name) return '';
  return COUNTRY_DISPLAY[name] || name;
}

export function severityFromScore(score: number): RiskSeverity {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function isDataFresh(iso: string | null | undefined, maxAgeMs = LIVE_FRESHNESS_MS): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t <= maxAgeMs;
}

export function isHeadlineLive(publishedAt: string, now = Date.now()): boolean {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= HEADLINE_LIVE_MS;
}

/**
 * Largest-remainder rounding so bearish + neutral + bullish === 100.
 */
export function roundPercentsTo100(weights: [number, number, number]): [number, number, number] {
  const total = weights[0] + weights[1] + weights[2];
  if (total <= 0) return [0, 100, 0];
  const raw = weights.map((w) => (w / total) * 100);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = 100 - floors.reduce((s, n) => s + n, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    floors[order[k % order.length].i] += 1;
  }
  return [floors[0], floors[1], floors[2]];
}

export function computeSentiment(articles: { sentiment: string }[]): SentimentBreakdown {
  if (!articles.length) {
    return {
      bearishPct: 0,
      neutralPct: 100,
      bullishPct: 0,
      gaugeScore: 50,
      label: 'NEUTRAL SENTIMENT'
    };
  }
  let neg = 0;
  let neu = 0;
  let pos = 0;
  for (const a of articles) {
    if (a.sentiment === 'negative') neg++;
    else if (a.sentiment === 'positive') pos++;
    else neu++;
  }
  const [bearishPct, neutralPct, bullishPct] = roundPercentsTo100([neg, neu, pos]);
  const gaugeScore = Math.round(bullishPct + neutralPct * 0.5);
  let label = 'NEUTRAL SENTIMENT';
  if (gaugeScore >= 55) label = 'BULLISH SENTIMENT';
  else if (gaugeScore <= 40) label = 'BEARISH SENTIMENT';
  return { bearishPct, neutralPct, bullishPct, gaugeScore, label };
}

const CRITICAL_EVENT_RE =
  /\b(nuclear|invasion|blockade|martial law|coup|assassination|sovereign default|market collapse|declaration of war)\b/i;

export function classifyEventSeverity(
  sentiment: string,
  text: string
): RiskSeverity {
  if (CRITICAL_EVENT_RE.test(text)) return 'critical';
  if (sentiment === 'negative') return 'high';
  if (sentiment === 'positive') return 'low';
  return 'medium';
}

export function impactScoreFromSeverity(severity: RiskSeverity): number {
  if (severity === 'critical') return 88;
  if (severity === 'high') return 72;
  if (severity === 'low') return 28;
  return 48;
}

/** Tail-risk events only — not every negative headline. */
export function isBlackSwanEvent(event: {
  severity: string;
  impactScore: number;
}): boolean {
  if (event.severity === 'critical') return true;
  return event.severity === 'high' && event.impactScore >= 78;
}

export function scoreDeltaFromTrend(
  currentScore: number,
  trend: { score: number | null }[]
): number | null {
  const real = trend.filter((t): t is { score: number } => t.score != null && Number.isFinite(t.score));
  if (real.length === 0) return null;
  const last = real[real.length - 1];
  if (last.score === currentScore) {
    if (real.length < 2) return null;
    return Math.round(currentScore - real[real.length - 2].score);
  }
  return Math.round(currentScore - last.score);
}

/** Actual session move must fall inside the predicted band. */
export function isImpactAligned(
  actualPct: number,
  minPct: number,
  maxPct: number,
  epsilon = 0.25
): boolean {
  if (![actualPct, minPct, maxPct].every((n) => Number.isFinite(n))) return false;
  const lo = Math.min(minPct, maxPct) - epsilon;
  const hi = Math.max(minPct, maxPct) + epsilon;
  return actualPct >= lo && actualPct <= hi;
}

export function uniqueTitles<T extends { title?: string; id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = (item.title || item.id || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export interface TrendGapPoint {
  day: string;
  date?: string;
  score: number | null;
}

export interface TrendGap {
  startKey: string;
  endKey: string;
  startLabel: string;
  endLabel: string;
  startIndex: number;
  endIndex: number;
  days: number;
  kind: 'interior' | 'leading' | 'trailing';
}

export function formatTrendAxisDay(dateOrDay: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrDay)) {
    const d = new Date(`${dateOrDay}T12:00:00Z`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return dateOrDay;
}

function trendPointKey(point: TrendGapPoint): string {
  return point.date || point.day;
}

function trendPointLabel(point: TrendGapPoint): string {
  return point.day || formatTrendAxisDay(trendPointKey(point));
}

/** Contiguous runs of missing snapshots. Gaps shorter than minDays are omitted. */
export function findTrendGaps(points: TrendGapPoint[], minDays = 2): TrendGap[] {
  const gaps: TrendGap[] = [];
  let i = 0;
  while (i < points.length) {
    if (points[i].score != null) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < points.length && points[i].score == null) i += 1;
    const end = i - 1;
    const days = end - start + 1;
    if (days < minDays) continue;

    const hasLeft = start > 0 && points[start - 1].score != null;
    const hasRight = end < points.length - 1 && points[end + 1].score != null;
    const kind: TrendGap['kind'] = hasLeft && hasRight ? 'interior' : start === 0 ? 'leading' : 'trailing';

    gaps.push({
      startKey: trendPointKey(points[start]),
      endKey: trendPointKey(points[end]),
      startLabel: trendPointLabel(points[start]),
      endLabel: trendPointLabel(points[end]),
      startIndex: start,
      endIndex: end,
      days,
      kind
    });
  }
  return gaps;
}

export function trendGapCaption(gap: TrendGap): { title: string; subtitle: string } {
  const subtitle =
    gap.startLabel === gap.endLabel
      ? gap.startLabel
      : compactDayRange(gap.startLabel, gap.endLabel);
  return {
    title: gap.kind === 'interior' ? 'Gap' : 'No data',
    subtitle
  };
}

function compactDayRange(startLabel: string, endLabel: string): string {
  const startParts = startLabel.split(' ');
  const endParts = endLabel.split(' ');
  if (startParts.length === 2 && endParts.length === 2 && startParts[0] === endParts[0]) {
    return `${startParts[0]} ${startParts[1]}–${endParts[1]}`;
  }
  return `${startLabel}–${endLabel}`;
}

const Y_MIN_SPAN = 25;
const Y_PAD_RATIO = 0.18;
const Y_PAD_FLOOR = 3;
const Y_STEP = 5;

/**
 * Y-axis domain from recorded scores only. Pads the range, enforces a minimum
 * span so small noise isn't exaggerated, and stays within 0–100.
 */
export function trendYAxisDomain(scores: number[]): [number, number] {
  const finite = scores.filter((s) => Number.isFinite(s));
  if (finite.length === 0) return [0, 100];

  const rawMin = Math.min(...finite);
  const rawMax = Math.max(...finite);
  const span = rawMax - rawMin;
  const pad = Math.max(span * Y_PAD_RATIO, Y_PAD_FLOOR);

  let lo = rawMin - pad;
  let hi = rawMax + pad;

  if (hi - lo < Y_MIN_SPAN) {
    const mid = (rawMin + rawMax) / 2;
    lo = mid - Y_MIN_SPAN / 2;
    hi = mid + Y_MIN_SPAN / 2;
  }

  lo = Math.floor(lo / Y_STEP) * Y_STEP;
  hi = Math.ceil(hi / Y_STEP) * Y_STEP;
  if (hi - lo < Y_MIN_SPAN) hi = lo + Y_MIN_SPAN;

  lo = Math.max(0, lo);
  hi = Math.min(100, hi);
  if (hi - lo < Y_MIN_SPAN) {
    if (lo === 0) hi = Math.min(100, Y_MIN_SPAN);
    else if (hi === 100) lo = Math.max(0, 100 - Y_MIN_SPAN);
  }
  if (lo >= hi) return [0, 100];
  return [lo, hi];
}
