/** Server-side quote cache — 12s TTL to dedupe concurrent requests */

export interface CachedQuote {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  lastUpdated: string;
  isMarketOpen: boolean;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, CachedQuote>();

export function getCachedQuote(symbol: string): CachedQuote | null {
  const entry = cache.get(symbol.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(symbol.toUpperCase());
    return null;
  }
  return entry;
}

export function setCachedQuote(symbol: string, quote: Omit<CachedQuote, 'fetchedAt'>): CachedQuote {
  const entry: CachedQuote = { ...quote, symbol: symbol.toUpperCase(), fetchedAt: Date.now() };
  cache.set(symbol.toUpperCase(), entry);
  return entry;
}

export function getCachedQuotes(symbols: string[]): Record<string, CachedQuote> {
  const out: Record<string, CachedQuote> = {};
  for (const s of symbols) {
    const q = getCachedQuote(s);
    if (q) out[s.toUpperCase()] = q;
  }
  return out;
}
