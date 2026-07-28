import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Pin,
  PinOff,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock
} from 'lucide-react';
import { SearchResultItem } from '../../types';
import { getPinnedTickers, togglePin } from '../../lib/watchlistService';

const RECENT_KEY = 'bs-recent-searches';
const MAX_RECENT = 10;
const DEBOUNCE_MS = 300;
const QUOTE_POLL_MS = 8000;
const RETRY_MS = 4000;

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

export function addRecentSearch(ticker: string, name?: string): string[] {
  const upper = ticker.toUpperCase();
  const stored: { ticker: string; name?: string }[] = (() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY + '-meta') || '[]');
    } catch {
      return [];
    }
  })();
  const filtered = stored.filter((s) => s.ticker !== upper);
  const next = [{ ticker: upper, name }, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY + '-meta', JSON.stringify(next));
  localStorage.setItem(RECENT_KEY, JSON.stringify(next.map((n) => n.ticker)));
  window.dispatchEvent(new CustomEvent('bs-recent-updated'));
  return next.map((n) => n.ticker);
}

export function getRecentSearchMeta(): { ticker: string; name?: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY + '-meta') || '[]');
  } catch {
    return getRecentSearches().map((t) => ({ ticker: t }));
  }
}

export function getQuickAccessChips(max = 10): { ticker: string; name?: string }[] {
  const seen = new Set<string>();
  const out: { ticker: string; name?: string }[] = [];
  for (const t of getPinnedTickers()) {
    const upper = t.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      out.push({ ticker: upper });
    }
  }
  for (const r of getRecentSearchMeta()) {
    if (!seen.has(r.ticker)) {
      seen.add(r.ticker);
      out.push(r);
    }
  }
  return out.slice(0, max);
}

async function fetchSearch(q: string, page: number): Promise<{
  results: SearchResultItem[];
  hasMore: boolean;
  error?: string;
}> {
  const res = await fetch(
    `/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=20`,
    { cache: 'no-store' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Search failed');
  return { results: data.results || [], hasMore: data.hasMore, error: data.error };
}

async function refreshQuotes(symbols: string[]): Promise<Record<string, SearchResultItem['quote']>> {
  if (symbols.length === 0) return {};
  const res = await fetch(
    `/api/search/quotes?symbols=${encodeURIComponent(symbols.join(','))}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return {};
  return res.json();
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

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

function chipsToResults(chips: { ticker: string; name?: string }[]): SearchResultItem[] {
  return chips.map((c) => ({
    symbol: c.ticker,
    displaySymbol: c.ticker,
    name: c.name || c.ticker,
    exchange: 'US',
    type: 'Common Stock',
    marketStatus: getMarketStatus(),
    quote: null
  }));
}

interface MarketSearchProps {
  onSelect: (ticker: string, name?: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  wide?: boolean;
}

export const MarketSearch: React.FC<MarketSearchProps> = ({
  onSelect,
  placeholder = 'Search any company — Apple, AAPL, TSLA...',
  className = '',
  inputClassName = '',
  wide = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [pinned, setPinned] = useState<string[]>(getPinnedTickers());
  const [browseMode, setBrowseMode] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolsKey = results.map((r) => r.displaySymbol).join(',');

  const enrichWithQuotes = useCallback(async (items: SearchResultItem[]) => {
    const symbols = items.map((r) => r.displaySymbol);
    const quotes = await refreshQuotes(symbols);
    return items.map((item) => {
      const key = item.displaySymbol.toUpperCase().split('.')[0];
      const q = quotes[key] || quotes[item.symbol.toUpperCase()];
      return q ? { ...item, quote: q as SearchResultItem['quote'] } : item;
    });
  }, []);

  const loadBrowse = useCallback(async () => {
    setBrowseMode(true);
    setLoading(true);
    setError(null);
    const chips = getQuickAccessChips(12);
    if (chips.length === 0) {
      try {
        const res = await fetch('/api/watchlist?limit=12', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const fromWl = (data.entries || []).slice(0, 12).map((e: { ticker: string; companyName: string }) => ({
            ticker: e.ticker,
            name: e.companyName
          }));
          chips.push(...fromWl);
        }
      } catch {
        /* ignore */
      }
    }
    const base = chipsToResults(chips);
    const enriched = await enrichWithQuotes(base);
    setResults(enriched);
    setHasMore(false);
    setHighlightIdx(enriched.length > 0 ? 0 : -1);
    setLoading(false);
  }, [enrichWithQuotes]);

  const loadSearch = useCallback(async (q: string, p: number, append = false) => {
    if (!q.trim()) {
      loadBrowse();
      return;
    }
    setBrowseMode(false);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSearch(q, p);
      if (data.error) setError(data.error);
      setResults((prev) => (append ? [...prev, ...data.results] : data.results));
      setHasMore(data.hasMore);
      setHighlightIdx(!append && data.results.length > 0 ? 0 : -1);
    } catch (e: any) {
      setError(e?.message || 'Unable to fetch live market data. Please try again.');
      if (!append) setResults([]);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => loadSearch(q, p, append), RETRY_MS);
    } finally {
      setLoading(false);
    }
  }, [loadBrowse]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      if (open) {
        if (query.trim()) loadSearch(query, 1, false);
        else loadBrowse();
      }
    }, query.trim() ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [query, open, loadSearch, loadBrowse]);

  useEffect(() => {
    if (!open || results.length === 0) return;
    const symbols = results.map((r) => r.displaySymbol);
    const poll = async () => {
      const quotes = await refreshQuotes(symbols);
      setResults((prev) =>
        prev.map((item) => {
          const key = item.displaySymbol.toUpperCase().split('.')[0];
          const q = quotes[key] || quotes[item.symbol.toUpperCase()];
          return q ? { ...item, quote: q as SearchResultItem['quote'] } : item;
        })
      );
    };
    poll();
    const timer = setInterval(poll, QUOTE_POLL_MS);
    return () => clearInterval(timer);
  }, [open, symbolsKey, results.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  const handleSelect = (item: SearchResultItem) => {
    const ticker = item.displaySymbol.toUpperCase().split('.')[0];
    addRecentSearch(ticker, item.name);
    onSelect(ticker, item.name);
    setQuery('');
    setOpen(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && results[highlightIdx]) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loading || !hasMore || browseMode) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      const next = page + 1;
      setPage(next);
      loadSearch(query, next, true);
    }
  };

  const showEmpty = !loading && !browseMode && query.trim().length >= 1 && results.length === 0 && !error;
  const dropdownWidth = wide ? 'min-w-[420px] w-full' : 'w-full';

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); if (!query.trim()) loadBrowse(); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={
          inputClassName ||
          'w-full bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] rounded-xl px-3.5 py-2.5 pl-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 shadow-sm'
        }
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />

      {open && (
        <div className={`absolute z-[100] mt-1.5 ${dropdownWidth} bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] rounded-xl shadow-2xl overflow-hidden`}>
          <div ref={listRef} onScroll={handleScroll} className="max-h-[min(420px,70vh)] overflow-y-auto custom-scrollbar">
            {browseMode && results.length > 0 && (
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 dark:border-[#232A3D]/40">
                <Clock className="w-3 h-3" /> Recent & Pinned
              </div>
            )}

            {loading && results.length === 0 && (
              <div className="p-2 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-slate-700/40" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-slate-700/40 rounded" />
                      <div className="h-2 w-1/2 bg-slate-700/30 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="px-4 py-6 text-center text-xs text-amber-500 flex flex-col items-center gap-2">
                <AlertCircle className="w-6 h-6" />{error}
                <span className="text-slate-500">Retrying automatically…</span>
              </div>
            )}

            {showEmpty && (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                No matching company found. Try another company name or ticker.
              </div>
            )}

            {results.map((item, idx) => {
              const quote = item.quote;
              const isUp = (quote?.change ?? 0) >= 0;
              const sym = item.displaySymbol.toUpperCase().split('.')[0];
              const isHighlighted = idx === highlightIdx;

              return (
                <div
                  key={`${item.symbol}-${idx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 text-left border-b border-slate-100 dark:border-[#232A3D]/40 last:border-0 transition-colors cursor-pointer ${
                    isHighlighted ? 'bg-blue-500/10 dark:bg-blue-500/15' : 'hover:bg-slate-50 dark:hover:bg-[#161B2C]'
                  }`}
                >
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt="" className="w-9 h-9 rounded-full bg-white object-contain p-0.5 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {initials(item.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-blue-500 dark:text-blue-400 font-bold">{sym}</span>
                      <span>•</span><span>{item.exchange}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        item.marketStatus === 'LIVE' ? 'bg-emerald-500/20 text-emerald-500' :
                        item.marketStatus === 'Premarket' ? 'bg-amber-500/20 text-amber-500' :
                        item.marketStatus === 'After Hours' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>{item.marketStatus}</span>
                    </div>
                  </div>
                  {quote ? (
                    <div className="text-right shrink-0 font-mono">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">${quote.price.toFixed(2)}</div>
                      <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{quote.change.toFixed(2)} ({isUp ? '+' : ''}{quote.percentChange.toFixed(2)}%)
                      </div>
                    </div>
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPinned(togglePin(sym)); }}
                    className="shrink-0 p-1 text-slate-400 hover:text-amber-400"
                    aria-label={pinned.includes(sym) ? 'Unpin' : 'Pin'}
                  >
                    {pinned.includes(sym) ? <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> : <PinOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
            {loading && results.length > 0 && (
              <div className="py-3 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { getPinnedTickers, togglePin };
