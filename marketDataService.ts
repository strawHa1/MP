import fs from 'fs';
import path from 'path';
import { getCachedQuote, setCachedQuote, CachedQuote } from './quoteCache.js';
import { getImpactState, refreshImpactData } from './impactService.js';
import { fetchHeadlines } from './newsApi.js';
import { recordDailySnapshot } from './dashboardTrendService.js';
import { fetchYahooQuote } from './yahooFinance.js';

export interface WatchlistEntry {
  ticker: string;
  companyName: string;
  sector: string;
  exchange: string;
  country: string;
  region: string;
}

export interface CompanyProfileResponse {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  region: string;
  exchange: string;
  marketCap: string;
  description: string;
  riskScore: number;
  sentimentScore: number;
  sentimentLabel: string;
  keyRisks: string[];
  aiSummary: string;
  riskTrend: { date: string; score: number }[];
  quote: CachedQuote | null;
  activeImpactCount: number;
  inWatchlist: boolean;
}

const SECTOR_BASE_RISK: Record<string, number> = {
  Semiconductors: 78,
  Technology: 48,
  Energy: 72,
  Defense: 38,
  Aerospace: 52,
  Financials: 55,
  Logistics: 65,
  Automotive: 58,
  Mining: 62,
  Healthcare: 40,
  Industrials: 50
};

const HIGH_EXPOSURE_COUNTRIES = new Set(['Taiwan', 'China', 'Israel', 'Ukraine', 'Iran']);

let watchlistCache: WatchlistEntry[] | null = null;
let sectorsCache: any[] | null = null;
let countriesCache: any[] | null = null;

function loadJson<T>(filename: string): T {
  const p = path.join(process.cwd(), 'data', filename);
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

export function getWatchlist(): WatchlistEntry[] {
  if (!watchlistCache) watchlistCache = loadJson('watchlist.json');
  return watchlistCache;
}

export function searchWatchlist(query: string, limit = 12): WatchlistEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return getWatchlist().slice(0, limit);
  return getWatchlist()
    .filter(
      (e) =>
        e.ticker.toLowerCase().includes(q) ||
        e.companyName.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export function getWatchlistEntry(ticker: string): WatchlistEntry | undefined {
  return getWatchlist().find((e) => e.ticker === ticker.toUpperCase());
}

function isUSMarketOpen(): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay();
  if (utcDay === 0 || utcDay === 6) return false;
  const totalUtcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return totalUtcMins >= 13 * 60 + 30 && totalUtcMins <= 20 * 60;
}

function formatTimestamp(): string {
  return (
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' UTC'
  );
}

const STOCK_BASELINES: Record<string, { price: number; prevClose: number }> = {
  NVDA: { price: 124.5, prevClose: 121.2 },
  AAPL: { price: 224.3, prevClose: 225.1 },
  TSM: { price: 172.8, prevClose: 176.4 },
  MSFT: { price: 442.1, prevClose: 440.5 },
  AMZN: { price: 186.2, prevClose: 184.9 },
  GOOGL: { price: 179.4, prevClose: 180.1 },
  XOM: { price: 118.7, prevClose: 115.3 },
  LMT: { price: 478.2, prevClose: 472 },
  JPM: { price: 208.5, prevClose: 207.1 },
  ASML: { price: 845, prevClose: 860.2 },
  AMD: { price: 154.2, prevClose: 151.8 },
  META: { price: 520, prevClose: 515 },
  TSLA: { price: 245, prevClose: 250 }
};

function simulatedQuote(symbol: string): CachedQuote {
  const baseline = STOCK_BASELINES[symbol] || { price: 150, prevClose: 148.5 };
  const seed = (symbol.charCodeAt(0) * 13 + Math.floor(Date.now() / 15000)) % 100;
  const jitter = (seed - 50) / 1000;
  const price = Number((baseline.price * (1 + jitter)).toFixed(2));
  const change = Number((price - baseline.prevClose).toFixed(2));
  const pct = Number(((change / baseline.prevClose) * 100).toFixed(2));
  return setCachedQuote(symbol, {
    symbol,
    price,
    change,
    percentChange: pct,
    high: Number((Math.max(price, baseline.prevClose) * 1.01).toFixed(2)),
    low: Number((Math.min(price, baseline.prevClose) * 0.99).toFixed(2)),
    previousClose: baseline.prevClose,
    volume: 15000000 + seed * 80000,
    lastUpdated: formatTimestamp(),
    isMarketOpen: isUSMarketOpen()
  });
}

export async function fetchQuote(symbol: string): Promise<CachedQuote | null> {
  const sym = symbol.toUpperCase().trim();
  const cached = getCachedQuote(sym);
  if (cached) return cached;

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${finnhubKey}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data: any = await res.json();
        if (data?.c > 0) {
          const prev = data.pc || data.c;
          const change = data.c - prev;
          return setCachedQuote(sym, {
            symbol: sym,
            price: Number(data.c.toFixed(2)),
            change: Number(change.toFixed(2)),
            percentChange: Number(((change / prev) * 100).toFixed(2)),
            high: Number((data.h || data.c).toFixed(2)),
            low: Number((data.l || data.c).toFixed(2)),
            previousClose: Number(prev.toFixed(2)),
            volume: data.v || 0,
            lastUpdated: formatTimestamp(),
            isMarketOpen: isUSMarketOpen()
          });
        }
      }
    } catch {
      /* try yahoo */
    }
  }

  const yahoo = await fetchYahooQuote(sym);
  if (yahoo) return yahoo;

  if (!finnhubKey) return simulatedQuote(sym);
  return null;
}

export async function fetchQuotesBatch(symbols: string[]): Promise<Record<string, CachedQuote>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const results: Record<string, CachedQuote> = {};
  await Promise.all(
    unique.map(async (sym) => {
      const q = await fetchQuote(sym);
      if (q) results[sym] = q;
    })
  );
  return results;
}

async function fetchFinnhubProfile(ticker: string): Promise<{
  name: string;
  marketCap: number;
  finnhubIndustry: string;
  country: string;
  exchange: string;
  logo?: string;
  weburl?: string;
} | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data?.name && !data?.ticker) return null;
    return {
      name: data.name || ticker,
      marketCap: data.marketCapitalization ? data.marketCapitalization * 1_000_000 : 0,
      finnhubIndustry: data.finnhubIndustry || data.industry || 'Unknown',
      country: data.country || 'Unknown',
      exchange: data.exchange || 'US',
      logo: data.logo,
      weburl: data.weburl
    };
  } catch {
    return null;
  }
}

function mapCountryToRegion(country: string): string {
  const c = country.toUpperCase();
  if (['US', 'UNITED STATES', 'USA'].some((x) => c.includes(x))) return 'North America';
  if (['TW', 'TAIWAN', 'CN', 'CHINA', 'JP', 'JAPAN', 'KR', 'KOREA'].some((x) => c.includes(x))) return 'East Asia';
  if (['IN', 'INDIA'].some((x) => c.includes(x))) return 'South Asia';
  if (['GB', 'UK', 'DE', 'GERMANY', 'FR', 'FRANCE', 'NL'].some((x) => c.includes(x))) return 'Europe';
  return 'Global';
}

export function computeRiskScoreForMeta(
  meta: { sector: string; country: string; ticker: string },
  quote: CachedQuote | null,
  impactCount: number
): number {
  let score = SECTOR_BASE_RISK[meta.sector] ?? 50;
  if (HIGH_EXPOSURE_COUNTRIES.has(meta.country)) score += 12;
  if (quote) score += Math.min(15, Math.abs(quote.percentChange) * 2);
  score += Math.min(10, impactCount * 3);
  if (meta.sector.toLowerCase().includes('semiconductor') && meta.country === 'Taiwan') score += 8;
  return Math.min(100, Math.max(10, Math.round(score)));
}

function buildKeyRisksForMeta(meta: { sector: string; country: string }, impactCount: number): string[] {
  const risks: string[] = [];
  if (meta.country === 'Taiwan' || meta.country.includes('TW')) risks.push('Taiwan Strait geopolitical and maritime disruption exposure');
  if (meta.sector.toLowerCase().includes('semiconductor')) risks.push('Advanced chip export control and supply chain concentration');
  if (meta.sector.toLowerCase().includes('energy') || meta.sector.toLowerCase().includes('oil')) risks.push('Oil transit chokepoint risk (Hormuz, Red Sea)');
  if (impactCount > 0) risks.push(`${impactCount} active news impact signal(s) detected in last 24h`);
  if (risks.length === 0) risks.push('Macroeconomic and sector-wide market volatility');
  return risks.slice(0, 4);
}

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return 'N/A';
}

function sentimentFromQuote(pct: number): { score: number; label: string } {
  if (pct <= -3) return { score: 25, label: 'Very Bearish' };
  if (pct <= -1) return { score: 38, label: 'Bearish' };
  if (pct >= 3) return { score: 78, label: 'Bullish' };
  if (pct >= 1) return { score: 62, label: 'Neutral' };
  return { score: 50, label: 'Neutral' };
}

export function computeRiskScore(
  entry: WatchlistEntry,
  quote: CachedQuote | null,
  impactCount: number
): number {
  return computeRiskScoreForMeta(
    { sector: entry.sector, country: entry.country, ticker: entry.ticker },
    quote,
    impactCount
  );
}

function buildKeyRisks(entry: WatchlistEntry, impactCount: number): string[] {
  const risks: string[] = [];
  if (entry.country === 'Taiwan') risks.push('Taiwan Strait geopolitical and maritime disruption exposure');
  if (entry.sector === 'Semiconductors') risks.push('Advanced chip export control and supply chain concentration');
  if (entry.sector === 'Energy') risks.push('Oil transit chokepoint risk (Hormuz, Red Sea)');
  if (entry.sector === 'Defense') risks.push('Defense procurement cycle and supply chain lead times');
  if (entry.sector === 'Logistics') risks.push('Maritime freight rate volatility and route disruptions');
  if (impactCount > 0) risks.push(`${impactCount} active news impact signal(s) detected in last 24h`);
  if (risks.length === 0) risks.push('Macroeconomic and sector-wide market volatility');
  return risks.slice(0, 4);
}

function buildRiskTrend(baseScore: number): { date: string; score: number }[] {
  const days = ['Jul 1', 'Jul 5', 'Jul 10', 'Jul 15', 'Jul 20', 'Jul 25'];
  return days.map((date, i) => ({
    date,
    score: Math.min(100, Math.max(10, baseScore - 8 + i * 2 + (i % 2) * 3))
  }));
}

export async function getCompanyProfile(ticker: string): Promise<CompanyProfileResponse | null> {
  const sym = ticker.toUpperCase().trim();
  const baseSym = sym.split('.')[0];
  const watchEntry = getWatchlistEntry(baseSym);

  const [quote, finnhub] = await Promise.all([fetchQuote(sym), fetchFinnhubProfile(sym)]);

  if (!finnhub && !quote && !watchEntry) return null;

  const name = finnhub?.name || watchEntry?.companyName || sym;
  const sector = finnhub?.finnhubIndustry || watchEntry?.sector || 'Unknown';
  const country = finnhub?.country || watchEntry?.country || 'Unknown';
  const region = watchEntry?.region || mapCountryToRegion(country);
  const exchange = finnhub?.exchange || watchEntry?.exchange || (sym.includes('.NS') ? 'NSE' : sym.includes('.BO') ? 'BSE' : 'US');

  const impacts = getImpactState().impactedCompanies.filter((r) => r.ticker === baseSym || r.ticker === sym);
  const meta = { sector, country, ticker: sym };
  const riskScore = computeRiskScoreForMeta(meta, quote, impacts.length);
  const sentiment = sentimentFromQuote(quote?.percentChange ?? 0);

  return {
    ticker: sym,
    name,
    sector,
    country,
    region,
    exchange,
    marketCap: finnhub?.marketCap ? formatMarketCap(finnhub.marketCap) : 'N/A',
    description: `${name} (${sym}) — ${sector} sector, listed on ${exchange}. Live market data and AI risk scoring powered by Finnhub.`,
    riskScore,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    keyRisks: buildKeyRisksForMeta(meta, impacts.length),
    aiSummary: `${name} (${sym}) composite risk score: ${riskScore}/100. Sector: ${sector}, region: ${region}. Live volatility and ${impacts.length} recent news impact signal(s) factored in.`,
    riskTrend: buildRiskTrend(riskScore),
    quote,
    activeImpactCount: impacts.length,
    inWatchlist: !!watchEntry
  };
}

export function getSectorsConfig() {
  if (!sectorsCache) sectorsCache = loadJson('sectors.json');
  return sectorsCache;
}

export function getSectorById(id: string) {
  return getSectorsConfig().find((s: any) => s.id === id);
}

function impactLevelFromScore(score: number): string {
  if (score >= 75) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

export async function getSectorLiveData(sectorId: string) {
  const sector = getSectorById(sectorId);
  if (!sector) return null;

  const tickers: string[] = [...new Set(sector.tickers as string[])];
  const quotes = await fetchQuotesBatch(tickers);
  const constituents = await Promise.all(
    tickers.map(async (t) => {
      const entry = getWatchlistEntry(t);
      const quote = quotes[t];
      const finnhub = entry ? null : await fetchFinnhubProfile(t);
      const name = entry?.companyName || finnhub?.name || t;
      const sector = entry?.sector || finnhub?.finnhubIndustry || 'Unknown';
      const country = entry?.country || finnhub?.country || 'Unknown';
      const impacts = getImpactState().impactedCompanies.filter((r) => r.ticker === t);
      const riskScore = computeRiskScoreForMeta({ sector, country, ticker: t }, quote, impacts.length);
      return {
        ticker: t,
        name,
        exchange: entry?.exchange || finnhub?.exchange || 'US',
        riskScore,
        quote
      };
    })
  );
  const valid = constituents;
  const avgRisk = valid.length
    ? Math.round(valid.reduce((s, c) => s + c.riskScore, 0) / valid.length)
    : 50;

  return {
    ...sector,
    riskScore: avgRisk,
    marketImpact: impactLevelFromScore(avgRisk),
    companyCount: valid.length,
    constituents: valid,
    lastUpdated: new Date().toISOString()
  };
}

export function getCountriesBase() {
  if (!countriesCache) countriesCache = loadJson('countries-base.json');
  return countriesCache;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 12,
  high: 8,
  medium: 4,
  low: 2
};

const SENTIMENT_WEIGHT: Record<string, number> = {
  negative: 8,
  neutral: 4,
  positive: 2
};

const REGION_ISO_MAP: Record<string, string> = {
  india: 'IN'
};

interface CountryRiskHeadline {
  title: string;
  description: string;
  region: 'india' | 'world';
  sentiment: 'negative' | 'neutral' | 'positive';
}

export function computeLiveCountryRisk(liveHeadlines: CountryRiskHeadline[] = []): {
  countries: Array<{
    id: string;
    name: string;
    isoCode: string;
    flag: string;
    region: string;
    riskScore: number;
    riskLevel: string;
    eventsCount: number;
    keyRisks: string[];
    scoreChanged: boolean;
    previousScore?: number;
  }>;
  lastUpdated: string;
} {
  const base = getCountriesBase();
  const impactState = getImpactState();
  const previousScores = countryRiskCache
    ? Object.fromEntries(countryRiskCache.countries.map((c) => [c.id, c.riskScore]))
    : {};

  const countries = base.map((c: any) => {
    let eventsCount = 0;
    let severitySum = 0;
    const vectors: string[] = [];
    const seenEvents = new Set<string>();

    const addEvent = (headline: string, weight: number) => {
      const key = headline.slice(0, 80);
      if (seenEvents.has(key)) return;
      seenEvents.add(key);
      eventsCount++;
      severitySum += weight;
      if (vectors.length < 5) vectors.push(headline.slice(0, 80));
    };

    for (const record of impactState.impactedCompanies) {
      const text = `${record.headline} ${record.description}`.toLowerCase();
      if (c.keywords.some((k: string) => text.includes(k))) {
        addEvent(record.headline, SEVERITY_WEIGHT[record.severity] || 4);
      }
    }

    for (const article of liveHeadlines) {
      const text = `${article.title} ${article.description}`.toLowerCase();
      const regionMatch = REGION_ISO_MAP[article.region] === c.isoCode;
      const keywordMatch = c.keywords.some((k: string) => text.includes(k));
      if (regionMatch || keywordMatch) {
        addEvent(article.title, SENTIMENT_WEIGHT[article.sentiment] || 4);
      }
    }

    let riskScore = 25 + eventsCount * 5 + severitySum;
    if (eventsCount === 0) {
      const structuralBaseline: Record<string, number> = {
        TW: 45,
        UA: 50,
        OM: 40,
        IR: 40
      };
      if (structuralBaseline[c.isoCode]) {
        riskScore = Math.max(riskScore, structuralBaseline[c.isoCode]);
      }
    }
    riskScore = Math.min(100, Math.max(15, Math.round(riskScore)));

    const riskLevel =
      riskScore >= 80 ? 'Critical' : riskScore >= 65 ? 'High' : riskScore >= 45 ? 'Medium' : 'Low';

    const defaultRisks: Record<string, string[]> = {
      TW: ['Semiconductor supply chain concentration', 'Taiwan Strait maritime risk'],
      UA: ['Black Sea corridor disruption', 'Energy infrastructure risk'],
      IL: ['Regional missile threats', 'Port transit delays'],
      OM: ['Oil tanker transit risk', 'Maritime war insurance spikes'],
      US: ['Fiscal policy shifts', 'Critical infrastructure cyber risk'],
      IN: ['Currency volatility', 'Foreign capital flow sensitivity'],
      JP: ['Yen exchange rate pressure', 'Export sector exposure']
    };

    const prevScore = previousScores[c.id];

    return {
      id: c.id,
      name: c.name,
      isoCode: c.isoCode,
      flag: c.flag,
      region: c.region,
      riskScore,
      riskLevel,
      eventsCount,
      keyRisks: vectors.length > 0 ? vectors : defaultRisks[c.isoCode] || ['Regional macroeconomic volatility'],
      scoreChanged: prevScore != null && prevScore !== riskScore,
      previousScore: prevScore != null && prevScore !== riskScore ? prevScore : undefined
    };
  });

  countries.sort((a, b) => b.riskScore - a.riskScore);
  return { countries, lastUpdated: new Date().toISOString() };
}

let countryRiskCache: ReturnType<typeof computeLiveCountryRisk> | null = null;
let countryRiskCacheTime = 0;
const COUNTRY_CACHE_MS = 5 * 60 * 1000;

export async function getLiveCountryRisk(force = false) {
  if (!force && countryRiskCache && Date.now() - countryRiskCacheTime < COUNTRY_CACHE_MS) {
    return countryRiskCache;
  }

  if (force) {
    await refreshImpactData(true);
  }

  const { articles } = await fetchHeadlines('all', 30);
  const headlines: CountryRiskHeadline[] = articles.map((a) => ({
    title: a.title,
    description: a.description,
    region: a.region,
    sentiment: a.sentiment
  }));

  countryRiskCache = computeLiveCountryRisk(headlines);
  countryRiskCacheTime = Date.now();
  const avgScore =
    countryRiskCache.countries.length > 0
      ? Math.round(
          countryRiskCache.countries.reduce((s, c) => s + c.riskScore, 0) /
            countryRiskCache.countries.length
        )
      : 50;
  recordDailySnapshot(avgScore);
  return countryRiskCache;
}

/** @deprecated use getLiveCountryRisk */
export function getLiveCountryRiskCached(force = false) {
  if (!force && countryRiskCache && Date.now() - countryRiskCacheTime < COUNTRY_CACHE_MS) {
    return countryRiskCache;
  }
  return computeLiveCountryRisk();
}
