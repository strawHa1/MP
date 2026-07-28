/**
 * Yahoo Finance fallback — no API key required for search & quotes.
 */
import { setCachedQuote, type CachedQuote } from './quoteCache.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; BlackSwan/1.0)' };

function formatTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export async function fetchYahooSearch(query: string): Promise<
  Array<{ symbol: string; name: string; exchange: string; type: string }>
> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=40&newsCount=0&listsCount=0`,
      { headers: UA, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const quotes = data?.quotes || [];
    return quotes
      .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchange || 'US',
        type: q.quoteType === 'EQUITY' ? 'Common Stock' : q.quoteType
      }));
  } catch {
    return [];
  }
}

export async function fetchYahooQuote(symbol: string): Promise<CachedQuote | null> {
  const sym = symbol.toUpperCase().trim();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
      { headers: UA, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
    const change = price - prev;
    const pct = prev ? (change / prev) * 100 : 0;

    return setCachedQuote(sym, {
      symbol: sym,
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      percentChange: Number(pct.toFixed(2)),
      high: Number((meta.regularMarketDayHigh || price).toFixed(2)),
      low: Number((meta.regularMarketDayLow || price).toFixed(2)),
      previousClose: Number(prev.toFixed(2)),
      volume: meta.regularMarketVolume || 0,
      lastUpdated: formatTimestamp(),
      isMarketOpen: meta.marketState === 'REGULAR'
    });
  } catch {
    return null;
  }
}
