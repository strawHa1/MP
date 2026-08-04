/**
 * News-to-stock impact pipeline: merges GNews macro + Finnhub company news,
 * classifies via Gemini (keyword fallback), enriches with live Finnhub quotes.
 */

import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { GoogleGenAI } from '@google/genai';
import { fetchHeadlines } from './newsApi.js';

export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ImpactSentiment = 'bearish' | 'neutral' | 'bullish';

export interface StockImpactRecord {
  id: string;
  newsId?: string;
  ticker: string;
  companyName: string;
  sector: string;
  country: string;
  region: string;
  headline: string;
  description: string;
  source: string;
  publishedAt: string;
  timeAgo: string;
  url: string;
  sentiment: ImpactSentiment;
  severity: ImpactSeverity;
  projectedImpactPct: { min: number; max: number };
  projectedImpactLabel: string;
  actualChangePct: number;
  currentPrice: number;
  volume: number;
  newsType: 'macro' | 'company';
}

export interface ImpactCacheState {
  impactedCompanies: StockImpactRecord[];
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  source: string;
}

export const WATCHLIST: {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  region: string;
  keywords: string[];
}[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors', country: 'United States', region: 'North America', keywords: ['nvidia', 'nvda', 'ai chip', 'gpu', 'accelerator'] },
  { ticker: 'TSM', name: 'Taiwan Semiconductor', sector: 'Semiconductors', country: 'Taiwan', region: 'East Asia', keywords: ['tsmc', 'taiwan semiconductor', 'taiwan chip', 'foundry'] },
  { ticker: 'ASML', name: 'ASML Holding', sector: 'Semiconductors', country: 'Netherlands', region: 'Europe', keywords: ['asml', 'euv', 'lithography'] },
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Consumer Electronics', country: 'United States', region: 'North America', keywords: ['apple', 'aapl', 'iphone', 'ipad'] },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors', country: 'United States', region: 'North America', keywords: ['amd', 'advanced micro', 'ryzen', 'epyc'] },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', country: 'United States', region: 'North America', keywords: ['microsoft', 'msft', 'azure', 'openai'] },
  { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', country: 'United States', region: 'North America', keywords: ['exxon', 'xom', 'exxonmobil'] },
  { ticker: 'CVX', name: 'Chevron Corporation', sector: 'Energy', country: 'United States', region: 'North America', keywords: ['chevron', 'cvx'] },
  { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Defense', country: 'United States', region: 'North America', keywords: ['lockheed', 'lmt', 'f-35', 'defense contract'] },
  { ticker: 'RTX', name: 'RTX Corporation', sector: 'Defense', country: 'United States', region: 'North America', keywords: ['rtx', 'raytheon', 'pratt & whitney'] },
  { ticker: 'BA', name: 'Boeing Company', sector: 'Aerospace', country: 'United States', region: 'North America', keywords: ['boeing', '737', '787'] },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', country: 'United States', region: 'North America', keywords: ['jpmorgan', 'jp morgan', 'jpm'] },
  { ticker: 'AMZN', name: 'Amazon.com', sector: 'Technology', country: 'United States', region: 'North America', keywords: ['amazon', 'amzn', 'aws'] },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', country: 'United States', region: 'North America', keywords: ['google', 'alphabet', 'googl'] }
];

const MACRO_SEARCH_TERMS = [
  'Taiwan strait semiconductor',
  'Hormuz oil shipping',
  'sanctions export controls',
  'tariffs trade war',
  'chip export restrictions',
  'geopolitical risk markets',
  'Middle East energy crisis',
  'Federal Reserve interest rates'
];

const MACRO_TICKER_MAP: { pattern: RegExp; tickers: string[] }[] = [
  { pattern: /taiwan|tsmc|semiconductor|chip export|foundry|asml|nvidia|gpu/i, tickers: ['TSM', 'NVDA', 'ASML', 'AMD', 'AAPL'] },
  { pattern: /hormuz|oil|crude|opec|energy|pipeline|chevron|exxon/i, tickers: ['XOM', 'CVX'] },
  { pattern: /sanction|tariff|trade war|export control/i, tickers: ['NVDA', 'TSM', 'ASML', 'AAPL'] },
  { pattern: /defense|military|nato|missile|lockheed|raytheon|f-35|pentagon|armed conflict|trade war|military exercise/i, tickers: ['LMT', 'RTX', 'BA'] },
  { pattern: /fed|interest rate|inflation|recession|bank|jpmorgan/i, tickers: ['JPM', 'MSFT', 'AMZN', 'GOOGL'] },
  { pattern: /amazon|cloud|aws|microsoft|azure|google/i, tickers: ['AMZN', 'MSFT', 'GOOGL'] }
];

const CACHE_FILE = path.join(process.cwd(), '.cache', 'impact-data.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // daily default
const MANUAL_REFRESH_COOLDOWN_MS = 60_000;

let state: ImpactCacheState = {
  impactedCompanies: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
  source: 'none'
};

let lastManualRefresh = 0;
let refreshPromise: Promise<ImpactCacheState> | null = null;

interface RawNewsItem {
  id: string;
  headline: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  newsType: 'macro' | 'company';
  tickerHint?: string;
}

function hashId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `impact-${Math.abs(hash).toString(36)}`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatImpactRange(min: number, max: number): string {
  const sign = min < 0 ? '' : '+';
  return `${sign}${min.toFixed(1)}% to ${sign}${max.toFixed(1)}%`;
}

function getCompanyMeta(ticker: string) {
  return WATCHLIST.find((c) => c.ticker === ticker) || {
    ticker,
    name: `${ticker} Corp`,
    sector: 'Unknown',
    country: 'Unknown',
    region: 'Global',
    keywords: [ticker.toLowerCase()]
  };
}

async function fetchGNewsMacro(limit = 5): Promise<RawNewsItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];

  const items: RawNewsItem[] = [];
  const seen = new Set<string>();

  for (const term of MACRO_SEARCH_TERMS.slice(0, 4)) {
    try {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(term)}&lang=en&max=${limit}&apikey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data: any = await res.json();
      for (const a of data?.articles || []) {
        const id = hashId(a.url || a.title);
        if (seen.has(id)) continue;
        seen.add(id);
        items.push({
          id,
          headline: a.title,
          description: a.description || a.title,
          source: a.source?.name || 'GNews',
          url: a.url,
          publishedAt: a.publishedAt,
          newsType: 'macro'
        });
      }
    } catch {
      /* try next term */
    }
  }
  return items;
}

async function fetchFinnhubCompanyNews(ticker: string, limit = 5): Promise<RawNewsItem[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return (data || []).slice(0, limit).map((item) => ({
      id: hashId(String(item.id) + item.url),
      headline: item.headline,
      description: item.summary || item.headline,
      source: item.source || 'Finnhub',
      url: item.url,
      publishedAt: new Date(item.datetime * 1000).toISOString(),
      newsType: 'company' as const,
      tickerHint: ticker
    }));
  } catch {
    return [];
  }
}

async function fetchFinnhubGeneralNews(limit = 15): Promise<RawNewsItem[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return (data || []).slice(0, limit).map((item) => ({
      id: hashId(String(item.id) + item.url),
      headline: item.headline,
      description: item.summary || item.headline,
      source: item.source || 'Finnhub',
      url: item.url,
      publishedAt: new Date(item.datetime * 1000).toISOString(),
      newsType: 'macro' as const
    }));
  } catch {
    return [];
  }
}

async function fetchRssFallback(): Promise<RawNewsItem[]> {
  const { articles } = await fetchHeadlines('world', 20);
  return articles.map((a) => ({
    id: a.id,
    headline: a.title,
    description: a.description,
    source: a.source,
    url: a.url,
    publishedAt: a.publishedAt,
    newsType: 'macro' as const
  }));
}

async function fetchLiveQuote(ticker: string): Promise<{ price: number; changePct: number; volume: number } | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const data: any = await res.json();
        if (data?.c > 0) {
          const prev = data.pc || data.c;
          return {
            price: Number(data.c.toFixed(2)),
            changePct: Number((((data.c - prev) / prev) * 100).toFixed(2)),
            volume: data.v || 0
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Simulated fallback aligned with server stock baselines
  const BASELINES: Record<string, { price: number; prev: number }> = {
    NVDA: { price: 124.5, prev: 121.2 },
    AAPL: { price: 224.3, prev: 225.1 },
    TSM: { price: 172.8, prev: 176.4 },
    ASML: { price: 845, prev: 860.2 },
    XOM: { price: 118.7, prev: 115.3 },
    LMT: { price: 478.2, prev: 472 },
    JPM: { price: 208.5, prev: 207.1 },
    AMD: { price: 154.2, prev: 151.8 },
    MSFT: { price: 442.1, prev: 440.5 },
    AMZN: { price: 186.2, prev: 184.9 },
    GOOGL: { price: 179.4, prev: 180.1 },
    CVX: { price: 158.4, prev: 156.1 },
    BA: { price: 178.6, prev: 181.2 },
    RTX: { price: 102.3, prev: 101.5 }
  };
  const b = BASELINES[ticker] || { price: 150, prev: 148.5 };
  const seed = (ticker.charCodeAt(0) * 7 + Math.floor(Date.now() / 60000)) % 100;
  const jitter = (seed - 50) / 500;
  const price = Number((b.price * (1 + jitter)).toFixed(2));
  return {
    price,
    changePct: Number((((price - b.prev) / b.prev) * 100).toFixed(2)),
    volume: 15000000 + seed * 50000
  };
}

interface ClassificationResult {
  ticker: string;
  sentiment: ImpactSentiment;
  severity: ImpactSeverity;
  projectedMin: number;
  projectedMax: number;
}

function keywordClassify(news: RawNewsItem): ClassificationResult[] {
  const text = `${news.headline} ${news.description}`.toLowerCase();
  const results: ClassificationResult[] = [];
  const tickers = new Set<string>();

  if (news.tickerHint) tickers.add(news.tickerHint);

  for (const { pattern, tickers: mapped } of MACRO_TICKER_MAP) {
    if (pattern.test(text)) mapped.forEach((t) => tickers.add(t));
  }

  for (const company of WATCHLIST) {
    if (company.keywords.some((k) => text.includes(k))) tickers.add(company.ticker);
  }

  // Skip news with no watchlist relevance (avoid false positives)
  if (tickers.size === 0) return [];

  const bearish = /war|crisis|sanction|tariff|decline|fall|drop|risk|blockade|conflict|restrict|ban|plunge|slump|hack|lawsuit|probe|investigation/i.test(text);
  const bullish = /surge|gain|rally|record|profit|deal|growth|rise|boost|partnership|beat|upgrade/i.test(text);
  const sentiment: ImpactSentiment = bearish && !bullish ? 'bearish' : bullish && !bearish ? 'bullish' : 'neutral';

  let severity: ImpactSeverity = 'medium';
  if (/critical|war|blockade|invasion|embargo|collapse|emergency/i.test(text)) severity = 'critical';
  else if (/sanction|tariff|crisis|major|significant|warning/i.test(text)) severity = 'high';
  else if (/minor|slight|steady|routine/i.test(text)) severity = 'low';

  const baseImpact = sentiment === 'bearish' ? -3 : sentiment === 'bullish' ? 2 : 0;
  const severityMult = severity === 'critical' ? 1.8 : severity === 'high' ? 1.4 : severity === 'low' ? 0.6 : 1;

  for (const ticker of tickers) {
    const mid = baseImpact * severityMult;
    results.push({
      ticker,
      sentiment,
      severity,
      projectedMin: Number((mid - 1.5).toFixed(1)),
      projectedMax: Number((mid + 1.5).toFixed(1))
    });
  }
  return results.slice(0, 6);
}

async function classifyWithGemini(newsItems: RawNewsItem[]): Promise<Map<string, ClassificationResult[]>> {
  const apiKey = process.env.GEMINI_API_KEY;
  const resultMap = new Map<string, ClassificationResult[]>();
  if (!apiKey || newsItems.length === 0) {
    for (const n of newsItems) resultMap.set(n.id, keywordClassify(n));
    return resultMap;
  }

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'black-swan-impact' } } });
    const watchlistStr = WATCHLIST.map((c) => `${c.ticker} (${c.name})`).join(', ');
    const batch = newsItems.slice(0, 12);
    const prompt = `You are a financial risk analyst. For each news item, classify which watchlist tickers are affected.

Watchlist: ${watchlistStr}

News items:
${batch.map((n, i) => `[${i}] id="${n.id}" type=${n.newsType} headline="${n.headline}" desc="${n.description.slice(0, 200)}"`).join('\n')}

Return JSON array only:
[{ "newsId": string, "impacts": [{ "ticker": string, "sentiment": "bearish"|"neutral"|"bullish", "severity": "critical"|"high"|"medium"|"low", "projectedMin": number, "projectedMax": number }] }]

projectedMin/Max are estimated same-day % stock impact (e.g. -4 to -2 for bad news). Only include tickers genuinely affected.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });

    const parsed: any[] = JSON.parse(response.text || '[]');
    for (const entry of parsed) {
      const impacts: ClassificationResult[] = (entry.impacts || [])
        .filter((i: any) => WATCHLIST.some((w) => w.ticker === i.ticker))
        .map((i: any) => ({
          ticker: i.ticker,
          sentiment: i.sentiment || 'neutral',
          severity: i.severity || 'medium',
          projectedMin: Number(i.projectedMin) || -2,
          projectedMax: Number(i.projectedMax) || 2
        }));
      if (impacts.length > 0) resultMap.set(entry.newsId, impacts);
    }
  } catch (e) {
    console.warn('Gemini impact classification failed, using keyword fallback:', e);
  }

  for (const n of newsItems) {
    if (!resultMap.has(n.id)) resultMap.set(n.id, keywordClassify(n));
  }
  return resultMap;
}

async function mergeNewsStreams(): Promise<{ items: RawNewsItem[]; source: string }> {
  const [macroGNews, finnhubGeneral, rss] = await Promise.all([
    fetchGNewsMacro(5),
    fetchFinnhubGeneralNews(15),
    fetchRssFallback()
  ]);

  const companyNewsArrays = await Promise.all(
    WATCHLIST.slice(0, 8).map((c) => fetchFinnhubCompanyNews(c.ticker, 3))
  );
  const companyNews = companyNewsArrays.flat();

  const seen = new Set<string>();
  const merged: RawNewsItem[] = [];
  const sources: string[] = [];

  for (const batch of [macroGNews, companyNews, finnhubGeneral, rss]) {
    if (batch.length > 0) {
      if (batch === macroGNews && macroGNews.length) sources.push('gnews');
      else if (batch === companyNews && companyNews.length) sources.push('finnhub-company');
      else if (batch === finnhubGeneral && finnhubGeneral.length) sources.push('finnhub-general');
      else if (batch === rss && rss.length) sources.push('rss');
    }
    for (const item of batch) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }

  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return { items: merged.slice(0, 30), source: sources.join('+') || 'fallback' };
}

function loadDiskCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (raw?.impactedCompanies?.length) {
        state = { ...state, ...raw, isLoading: false };
      }
    }
  } catch {
    /* ignore */
  }
}

function saveDiskCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        impactedCompanies: state.impactedCompanies,
        lastUpdated: state.lastUpdated,
        source: state.source
      })
    );
  } catch {
    /* ignore */
  }
}

export function getImpactState(): ImpactCacheState {
  return { ...state };
}

export async function refreshImpactData(force = false): Promise<ImpactCacheState> {
  if (!force && state.lastUpdated) {
    const age = Date.now() - new Date(state.lastUpdated).getTime();
    if (age < CACHE_TTL_MS && state.impactedCompanies.length > 0) return getImpactState();
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    state.isLoading = true;
    state.error = null;

    try {
      const { items: newsItems, source: newsSource } = await mergeNewsStreams();
      if (newsItems.length === 0) {
        state.error = 'No news data available';
        state.isLoading = false;
        return getImpactState();
      }

      const classifications = await classifyWithGemini(newsItems);
      const records: StockImpactRecord[] = [];
      const seenRecord = new Set<string>();

      for (const news of newsItems) {
        const impacts = classifications.get(news.id) || [];
        for (const impact of impacts) {
          const key = `${impact.ticker}-${news.id}`;
          if (seenRecord.has(key)) continue;
          seenRecord.add(key);

          const meta = getCompanyMeta(impact.ticker);
          const quote = await fetchLiveQuote(impact.ticker);
          if (!quote) continue;

          records.push({
            id: hashId(key),
            newsId: news.id,
            ticker: impact.ticker,
            companyName: meta.name,
            sector: meta.sector,
            country: meta.country,
            region: meta.region,
            headline: news.headline,
            description: news.description,
            source: news.source,
            publishedAt: news.publishedAt,
            timeAgo: formatTimeAgo(news.publishedAt),
            url: (news.url || '').replace(/&amp;/g, '&'),
            sentiment: impact.sentiment,
            severity: impact.severity,
            projectedImpactPct: { min: impact.projectedMin, max: impact.projectedMax },
            projectedImpactLabel: formatImpactRange(impact.projectedMin, impact.projectedMax),
            actualChangePct: quote.changePct,
            currentPrice: quote.price,
            volume: quote.volume,
            newsType: news.newsType
          });
        }
      }

      records.sort((a, b) => {
        const sev = { critical: 4, high: 3, medium: 2, low: 1 };
        return (sev[b.severity] - sev[a.severity]) || (Math.abs(b.actualChangePct) - Math.abs(a.actualChangePct));
      });

      state.impactedCompanies = records.slice(0, 40);
      state.lastUpdated = new Date().toISOString();
      state.source = newsSource;
      state.isLoading = false;
      state.error = records.length === 0 ? 'No matching impacts found for watchlist' : null;
      saveDiskCache();
    } catch (e: any) {
      state.error = e?.message || 'Failed to refresh impact data';
      state.isLoading = false;
    } finally {
      refreshPromise = null;
    }

    return getImpactState();
  })();

  return refreshPromise;
}

export async function manualRefreshImpact(): Promise<{ ok: boolean; state: ImpactCacheState; message?: string }> {
  const now = Date.now();
  if (now - lastManualRefresh < MANUAL_REFRESH_COOLDOWN_MS) {
    return {
      ok: false,
      state: getImpactState(),
      message: `Please wait ${Math.ceil((MANUAL_REFRESH_COOLDOWN_MS - (now - lastManualRefresh)) / 1000)}s before refreshing again`
    };
  }
  lastManualRefresh = now;
  const result = await refreshImpactData(true);
  return { ok: true, state: result };
}

export async function refreshLivePrices(): Promise<void> {
  if (state.impactedCompanies.length === 0) return;
  const tickers = [...new Set(state.impactedCompanies.map((r) => r.ticker))];
  const quotes: Record<string, { price: number; changePct: number; volume: number }> = {};
  await Promise.all(
    tickers.map(async (t) => {
      const q = await fetchLiveQuote(t);
      if (q) quotes[t] = q;
    })
  );
  state.impactedCompanies = state.impactedCompanies.map((r) => {
    const q = quotes[r.ticker];
    if (!q) return r;
    return { ...r, currentPrice: q.price, actualChangePct: q.changePct, volume: q.volume };
  });
}

export function initImpactService(): void {
  loadDiskCache();
  refreshImpactData().catch(console.error);
}

export function startImpactCron(): void {
  cron.schedule('0 6 * * *', () => {
    console.log('[Impact] Daily cron refresh starting...');
    refreshImpactData(true).catch(console.error);
  });
  console.log('[Impact] Daily cron scheduled (06:00 UTC)');
}

export function startImpactPricePolling(intervalMs = 30_000): void {
  setInterval(() => {
    refreshLivePrices().catch(console.error);
  }, intervalMs);
}
