/**
 * Live universal symbol search via Finnhub — Groww/Bloomberg-style ranking & enrichment.
 */
import { fetchQuotesBatch } from './marketDataService.js';
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
const searchCache = new Map<string, { data: SearchResultItem[]; timestamp: number }>();
const logoCache = new Map<string, string | null>();

const EXCHANGE_MAP: Record<string, string> = {
  US: 'NASDAQ/NYSE',
  L: 'LSE',
  NSE: 'NSE',
  BSE: 'BSE',
  TO: 'TSX',
  HK: 'HKEX',
  AX: 'ASX'
};

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

function rankScore(query: string, item: { symbol: string; displaySymbol: string; description: string; type: string }): number {
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
  if (item.type === 'Common Stock') score += 50;
  return score;
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
  if (logoCache.has(symbol)) {
    const v = logoCache.get(symbol);
    return v || undefined;
  }
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data: any = await res.json();
      const logo = data?.logo || null;
      logoCache.set(symbol, logo);
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
  logoCache.set(symbol, null);
  return undefined;
}

function parseExchange(symbol: string, type: string): string {
  if (symbol.includes('.')) {
    const suffix = symbol.split('.').pop()?.toUpperCase() || '';
    return EXCHANGE_MAP[suffix] || suffix;
  }
  if (type?.includes('ETP') || type?.includes('ETF')) return 'ETF';
  return 'NASDAQ/NYSE';
}

function normalizeItem(raw: any): Omit<SearchResultItem, 'quote' | 'marketStatus'> {
  const displaySymbol = raw.displaySymbol || raw.symbol || '';
  const symbol = raw.symbol || displaySymbol;
  return {
    symbol,
    displaySymbol,
    name: raw.description || displaySymbol,
    exchange: parseExchange(symbol, raw.type || ''),
    type: raw.type || 'Common Stock',
    logoUrl: undefined
  };
}

export async function searchMarketSymbols(
  query: string,
  page = 1,
  limit = 20
): Promise<{ results: SearchResultItem[]; total: number; page: number; hasMore: boolean; error?: string }> {
  const q = query.trim();
  if (q.length < 1) {
    return { results: [], total: 0, page, hasMore: false };
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  let items: SearchResultItem[];

  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    items = cached.data;
  } else {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      return {
        results: [],
        total: 0,
        page,
        hasMore: false,
        error: 'Unable to fetch live market data. Please configure FINNHUB_API_KEY.'
      };
    }

    const raw = await fetchFinnhubSearch(q);
    if (raw.length === 0) {
      return { results: [], total: 0, page, hasMore: false };
    }

    const ranked = raw
      .map((r) => ({ raw: r, score: rankScore(q, r) }))
      .sort((a, b) => b.score - a.score)
      .map(({ raw }) => normalizeItem(raw));

    const seen = new Set<string>();
    items = [];
    for (const item of ranked) {
      const k = item.displaySymbol.toUpperCase();
      if (seen.has(k)) continue;
      seen.add(k);
      items.push({ ...item, marketStatus: getMarketStatus(), quote: null });
    }

    searchCache.set(cacheKey, { data: items, timestamp: Date.now() });
  }

  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);
  const symbols = pageItems.map((i) => i.displaySymbol.toUpperCase().split('.')[0]);
  const quotes = await fetchQuotesBatch([...new Set(symbols)]);

  const enriched = await Promise.all(
    pageItems.map(async (item) => {
      const quoteKey = item.displaySymbol.toUpperCase().split('.')[0];
      const logoUrl = await fetchLogo(quoteKey);
      return {
        ...item,
        logoUrl,
        quote: quotes[quoteKey] || quotes[item.symbol.toUpperCase()] || null,
        marketStatus: getMarketStatus()
      };
    })
  );

  return {
    results: enriched,
    total: items.length,
    page,
    hasMore: start + limit < items.length
  };
}

export async function refreshSearchQuotes(symbols: string[]): Promise<Record<string, CachedQuote>> {
  const clean = [...new Set(symbols.map((s) => s.toUpperCase().split('.')[0]))];
  return fetchQuotesBatch(clean);
}
