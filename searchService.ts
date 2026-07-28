/**
 * Live universal symbol search via Finnhub — full market universe + ranked search.
 */
import fs from 'fs';
import path from 'path';
import { fetchQuotesBatch } from './marketDataService.js';
import { fetchYahooSearch } from './yahooFinance.js';
import type { CachedQuote } from './quoteCache.js';

export interface SearchResultItem {
  symbol: string;
  displaySymbol: string;
  name: string;
  exchange: string;
  type: string;
  logoUrl?: string;
  quote?: CachedQuote | null;
  marketStatus: 'LIVE' | 'Closed' | 'Premarket' | 'After Hours';
}

const SEARCH_CACHE_TTL = 30_000;
const UNIVERSE_TTL = 24 * 60 * 60 * 1000;
const searchCache = new Map<string, { data: SearchResultItem[]; timestamp: number }>();
const logoCache = new Map<string, string | null>();

const FINNHUB_EXCHANGES = ['US', 'NSE', 'BSE', 'L', 'TO', 'HK', 'AX'];

const POPULAR_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'BRK.A',
  'JPM', 'V', 'UNH', 'XOM', 'MA', 'HD', 'PG', 'JNJ', 'AVGO', 'LLY', 'BAC', 'KO', 'PEP',
  'COST', 'MRK', 'WMT', 'AMD', 'NFLX', 'ADBE', 'CRM', 'INTC', 'CSCO', 'TMO', 'DIS',
  'ABNB', 'UBER', 'COIN', 'BA', 'NKE', 'SBUX', 'TSM', 'ASML', 'BABA', 'SONY', 'SAP'
]);

const EXCHANGE_MAP: Record<string, string> = {
  US: 'NASDAQ/NYSE',
  L: 'LSE',
  NSE: 'NSE',
  BSE: 'BSE',
  TO: 'TSX',
  HK: 'HKEX',
  AX: 'ASX'
};

let symbolUniverse: SearchResultItem[] = [];
let universeLoadedAt = 0;
let universeLoadPromise: Promise<void> | null = null;

function getMarketStatus(): SearchResultItem['marketStatus'] {
  const now = new Date();
  const utcDay = now.getUTCDay();
  if (utcDay === 0 || utcDay === 6) return 'Closed';
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (mins >= 8 * 60 && mins < 13 * 60 + 30) return 'Premarket';
  if (mins >= 13 * 60 + 30 && mins <= 20 * 60) return 'LIVE';
  if (mins > 20 * 60 && mins < 24 * 60) return 'After Hours';
  return 'Closed';
}

function rankScore(
  query: string,
  item: { symbol: string; displaySymbol: string; description: string; type: string }
): number {
  const q = query.toLowerCase().trim();
  const sym = (item.displaySymbol || item.symbol).toLowerCase();
  const name = (item.description || '').toLowerCase();
  let score = 0;
  if (sym === q) score += 1000;
  else if (sym.startsWith(q)) score += 500;
  else if (sym.includes(q)) score += 200;
  if (name === q) score += 800;
  else if (name.startsWith(q)) score += 400;
  else if (name.includes(q)) score += 150;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => name.includes(w) || sym.includes(w))) score += 350;
  if (item.type === 'Common Stock') score += 50;
  if (POPULAR_TICKERS.has((item.displaySymbol || item.symbol).toUpperCase().split('.')[0])) score += 80;
  return score;
}

function parseExchange(symbol: string, mic?: string, type?: string): string {
  if (symbol.includes('.')) {
    const suffix = symbol.split('.').pop()?.toUpperCase() || '';
    return EXCHANGE_MAP[suffix] || suffix;
  }
  if (mic) return mic;
  if (type?.includes('ETP') || type?.includes('ETF')) return 'ETF';
  return 'NASDAQ/NYSE';
}

function normalizeRaw(raw: any, exchangeCode: string): Omit<SearchResultItem, 'quote' | 'marketStatus'> {
  const displaySymbol = raw.displaySymbol || raw.symbol || '';
  const symbol = raw.symbol || displaySymbol;
  return {
    symbol,
    displaySymbol,
    name: raw.description || displaySymbol,
    exchange: parseExchange(symbol, raw.mic, raw.type || ''),
    type: raw.type || 'Common Stock',
    logoUrl: undefined
  };
}

function normalizeItem(raw: any): Omit<SearchResultItem, 'quote' | 'marketStatus'> {
  return normalizeRaw(raw, '');
}

async function fetchExchangeSymbols(exchange: string, token: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/symbol?exchange=${encodeURIComponent(exchange)}&token=${token}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadLocalSymbolUniverse(): SearchResultItem[] {
  const seen = new Set<string>();
  const items: SearchResultItem[] = [];

  const add = (symbol: string, name: string, exchange: string, type = 'Common Stock') => {
    const displaySymbol = symbol.toUpperCase();
    if (seen.has(displaySymbol)) return;
    seen.add(displaySymbol);
    items.push({
      symbol: displaySymbol,
      displaySymbol,
      name,
      exchange,
      type,
      marketStatus: getMarketStatus(),
      quote: null
    });
  };

  try {
    const watchlistPath = path.join(process.cwd(), 'data', 'watchlist.json');
    const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8')) as Array<{
      ticker: string; companyName: string; exchange: string;
    }>;
    for (const w of watchlist) add(w.ticker, w.companyName, w.exchange);
  } catch { /* ignore */ }

  try {
    const extraPath = path.join(process.cwd(), 'data', 'market-symbols-extra.json');
    const extra = JSON.parse(fs.readFileSync(extraPath, 'utf-8')) as Array<{
      symbol: string; name: string; exchange: string; type?: string;
    }>;
    for (const e of extra) add(e.symbol, e.name, e.exchange, e.type || 'Common Stock');
  } catch { /* ignore */ }

  items.sort((a, b) => {
    const aPop = POPULAR_TICKERS.has(a.displaySymbol.split('.')[0]) ? 0 : 1;
    const bPop = POPULAR_TICKERS.has(b.displaySymbol.split('.')[0]) ? 0 : 1;
    if (aPop !== bPop) return aPop - bPop;
    return a.name.localeCompare(b.name);
  });

  return items;
}

function normalizeYahoo(raw: { symbol: string; name: string; exchange: string; type: string }): Omit<SearchResultItem, 'quote' | 'marketStatus'> {
  return {
    symbol: raw.symbol,
    displaySymbol: raw.symbol,
    name: raw.name,
    exchange: raw.exchange || parseExchange(raw.symbol, '', raw.type),
    type: raw.type || 'Common Stock',
    logoUrl: undefined
  };
}

async function loadFinnhubUniverse(token: string): Promise<SearchResultItem[]> {
  const all: SearchResultItem[] = [];
  const seen = new Set<string>();

  for (const exchange of FINNHUB_EXCHANGES) {
    const rows = await fetchExchangeSymbols(exchange, token);
    for (const raw of rows) {
      if (!raw?.symbol && !raw?.displaySymbol) continue;
      const type = raw.type || '';
      if (type && !type.toLowerCase().includes('stock') && !type.toLowerCase().includes('etp') && !type.toLowerCase().includes('etf')) {
        continue;
      }
      const item = normalizeRaw(raw, exchange);
      const k = item.displaySymbol.toUpperCase();
      if (seen.has(k)) continue;
      seen.add(k);
      all.push({ ...item, marketStatus: getMarketStatus(), quote: null });
    }
  }

  all.sort((a, b) => {
    const aPop = POPULAR_TICKERS.has(a.displaySymbol.toUpperCase().split('.')[0]) ? 0 : 1;
    const bPop = POPULAR_TICKERS.has(b.displaySymbol.toUpperCase().split('.')[0]) ? 0 : 1;
    if (aPop !== bPop) return aPop - bPop;
    return a.displaySymbol.localeCompare(b.displaySymbol);
  });

  return all;
}

export async function ensureSymbolUniverse(): Promise<number> {
  if (symbolUniverse.length > 0 && Date.now() - universeLoadedAt < UNIVERSE_TTL) {
    return symbolUniverse.length;
  }

  if (!universeLoadPromise) {
    universeLoadPromise = (async () => {
      const key = process.env.FINNHUB_API_KEY;
      if (key) {
        try {
          symbolUniverse = await loadFinnhubUniverse(key);
          if (symbolUniverse.length > 0) {
            console.log(`[Search] Loaded ${symbolUniverse.length} symbols from Finnhub`);
            universeLoadedAt = Date.now();
            universeLoadPromise = null;
            return;
          }
        } catch {
          /* fall through to local */
        }
      }

      symbolUniverse = loadLocalSymbolUniverse();
      universeLoadedAt = Date.now();
      universeLoadPromise = null;
      console.log(`[Search] Loaded ${symbolUniverse.length} symbols from local database`);
    })();
  }

  await universeLoadPromise;
  return symbolUniverse.length;
}

async function fetchFinnhubSearch(query: string): Promise<any[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return data?.result || [];
  } catch {
    return [];
  }
}

async function fetchLogo(symbol: string): Promise<string | undefined> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return undefined;
  const base = symbol.toUpperCase().split('.')[0];
  if (logoCache.has(base)) {
    const v = logoCache.get(base);
    return v || undefined;
  }
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(base)}&token=${key}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data: any = await res.json();
      const logo = data?.logo || null;
      logoCache.set(base, logo);
      if (logo) return logo;
      if (data?.weburl) {
        try {
          const domain = new URL(data.weburl.startsWith('http') ? data.weburl : `https://${data.weburl}`).hostname;
          return `https://logo.clearbit.com/${domain}`;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  logoCache.set(base, null);
  return undefined;
}

function searchLocalUniverse(query: string): SearchResultItem[] {
  const q = query.toLowerCase().trim();
  if (!q || symbolUniverse.length === 0) return [];

  return symbolUniverse
    .map((item) => ({
      item,
      score: rankScore(q, {
        symbol: item.symbol,
        displaySymbol: item.displaySymbol,
        description: item.name,
        type: item.type
      })
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

async function enrichPage(pageItems: SearchResultItem[]): Promise<SearchResultItem[]> {
  const symbols = pageItems.map((i) => i.displaySymbol.toUpperCase());
  const quotes = await fetchQuotesBatch([...new Set(symbols)]);

  return Promise.all(
    pageItems.map(async (item) => {
      const full = item.displaySymbol.toUpperCase();
      const base = full.split('.')[0];
      const logoUrl = await fetchLogo(base);
      return {
        ...item,
        logoUrl,
        quote: quotes[full] || quotes[base] || quotes[item.symbol.toUpperCase()] || null,
        marketStatus: getMarketStatus()
      };
    })
  );
}

async function buildSearchResults(query: string): Promise<SearchResultItem[]> {
  const q = query.trim();
  await ensureSymbolUniverse();

  const localMatches = searchLocalUniverse(q);
  const yahooRaw = await fetchYahooSearch(q);
  const finnhubRaw = process.env.FINNHUB_API_KEY ? await fetchFinnhubSearch(q) : [];

  const rankedYahoo = yahooRaw
    .map((r) => ({
      item: normalizeYahoo(r),
      score: rankScore(q, { symbol: r.symbol, displaySymbol: r.symbol, description: r.name, type: r.type })
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  const rankedFinnhub = finnhubRaw
    .map((r) => ({ raw: r, score: rankScore(q, r) }))
    .sort((a, b) => b.score - a.score)
    .map(({ raw }) => normalizeItem(raw));

  const seen = new Set<string>();
  const items: SearchResultItem[] = [];

  const push = (partial: Omit<SearchResultItem, 'quote' | 'marketStatus'>) => {
    const k = partial.displaySymbol.toUpperCase();
    if (seen.has(k)) return;
    seen.add(k);
    items.push({ ...partial, marketStatus: getMarketStatus(), quote: null });
  };

  for (const item of localMatches) push(item);
  for (const item of rankedYahoo) push(item);
  for (const item of rankedFinnhub) push(item);

  return items;
}

export async function browseMarketSymbols(
  page = 1,
  limit = 20
): Promise<{ results: SearchResultItem[]; total: number; page: number; hasMore: boolean; error?: string }> {
  await ensureSymbolUniverse();
  const start = (page - 1) * limit;
  const pageItems = symbolUniverse.slice(start, start + limit);
  const enriched = await enrichPage(pageItems);

  return {
    results: enriched,
    total: symbolUniverse.length,
    page,
    hasMore: start + limit < symbolUniverse.length
  };
}

export async function searchMarketSymbols(
  query: string,
  page = 1,
  limit = 20
): Promise<{ results: SearchResultItem[]; total: number; page: number; hasMore: boolean; error?: string }> {
  const q = query.trim();
  if (q.length < 1) {
    return browseMarketSymbols(page, limit);
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  let items: SearchResultItem[];

  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    items = cached.data;
  } else {
    items = await buildSearchResults(q);
    searchCache.set(cacheKey, { data: items, timestamp: Date.now() });
  }

  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);
  const enriched = await enrichPage(pageItems);

  return {
    results: enriched,
    total: items.length,
    page,
    hasMore: start + limit < items.length
  };
}

export async function refreshSearchQuotes(symbols: string[]): Promise<Record<string, CachedQuote>> {
  const clean = [...new Set(symbols.map((s) => s.toUpperCase().trim()))];
  return fetchQuotesBatch(clean);
}

/** Preload symbol universe on server startup */
export function initSearchUniverse(): void {
  ensureSymbolUniverse().catch(() => {});
}
