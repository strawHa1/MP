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
  trend: { score: number }[]
): number | null {
  if (trend.length === 0) return null;
  const last = trend[trend.length - 1];
  if (!last || !Number.isFinite(last.score)) return null;
  if (last.score === currentScore) {
    if (trend.length < 2) return null;
    const prior = trend[trend.length - 2];
    if (!prior || !Number.isFinite(prior.score)) return null;
    return Math.round(currentScore - prior.score);
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
