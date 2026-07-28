import { WatchlistEntry, CompanyProfile } from '../types';

const PINNED_KEY = 'bs-pinned-tickers';

let watchlistCache: WatchlistEntry[] | null = null;

export async function fetchWatchlist(query = ''): Promise<WatchlistEntry[]> {
  const url = query
    ? `/api/watchlist?q=${encodeURIComponent(query)}&limit=15`
    : '/api/watchlist';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load watchlist');
  const data = await res.json();
  if (!query) watchlistCache = data.entries;
  return data.entries;
}

export function filterWatchlistLocal(query: string, entries: WatchlistEntry[]): WatchlistEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, 12);
  return entries
    .filter(
      (e) =>
        e.ticker.toLowerCase().includes(q) ||
        e.companyName.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q)
    )
    .slice(0, 12);
}

export async function getAllWatchlist(): Promise<WatchlistEntry[]> {
  if (watchlistCache) return watchlistCache;
  return fetchWatchlist();
}

export function getPinnedTickers(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

export function setPinnedTickers(tickers: string[]): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify(tickers));
}

export function togglePin(ticker: string): string[] {
  const pinned = getPinnedTickers();
  const upper = ticker.toUpperCase();
  const next = pinned.includes(upper) ? pinned.filter((t) => t !== upper) : [...pinned, upper];
  setPinnedTickers(next);
  return next;
}

export function isPinned(ticker: string): boolean {
  return getPinnedTickers().includes(ticker.toUpperCase());
}

export async function fetchCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  const res = await fetch(`/api/companies/${encodeURIComponent(ticker.toUpperCase())}`, {
    cache: 'no-store'
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load company profile');
  const data = await res.json();
  return {
    ticker: data.ticker,
    name: data.name,
    sector: data.sector,
    country: data.country,
    marketCap: data.marketCap,
    riskScore: data.riskScore,
    sentimentScore: data.sentimentScore,
    sentimentLabel: data.sentimentLabel,
    description: data.description,
    keyRisks: data.keyRisks,
    aiSummary: data.aiSummary,
    recentNews: [],
    riskTrend: data.riskTrend,
    exchange: data.exchange,
    region: data.region,
    quote: data.quote,
    activeImpactCount: data.activeImpactCount,
    inWatchlist: data.inWatchlist
  };
}
