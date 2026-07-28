import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsArticle, NewsFeedResponse, GlobalEvent } from '../types';

const headlinesCache: Record<string, { data: NewsFeedResponse; timestamp: number }> = {};
const companyCache: Record<string, { data: NewsArticle[]; timestamp: number }> = {};

export const NEWS_POLL_INTERVAL_MS = 120_000; // 2 minutes

function inferCategory(text: string): GlobalEvent['category'] {
  if (/supply.?chain|shipping|port|freight|logistics/i.test(text)) return 'Supply Chain';
  if (/cyber|hack|breach|malware/i.test(text)) return 'Cybersecurity';
  if (/oil|energy|gas|opec|pipeline/i.test(text)) return 'Energy';
  if (/gdp|inflation|rate|fed|central bank|monetary/i.test(text)) return 'Macroeconomic';
  if (/climate|flood|drought|weather|hurricane/i.test(text)) return 'Climate';
  return 'Geopolitical';
}

export function articleToGlobalEvent(article: NewsArticle, index: number): GlobalEvent {
  const severity =
    article.sentiment === 'negative' ? 'high' : article.sentiment === 'positive' ? 'low' : 'medium';
  const impactScore =
    article.sentiment === 'negative'
      ? 65 + (index % 20)
      : article.sentiment === 'positive'
        ? 25 + (index % 15)
        : 45 + (index % 20);

  return {
    id: article.id,
    title: article.title,
    description: article.description,
    severity,
    impactScore,
    region: article.region === 'india' ? 'South Asia' : 'Global',
    countryIso: article.region === 'india' ? 'IN' : undefined,
    sources: [article.source],
    reportedAt: article.timeAgo,
    category: inferCategory(`${article.title} ${article.description}`),
    affectedCompanyTickers: [],
    marketImpactSummary: article.description.slice(0, 200),
    url: article.url,
    isLive: true
  };
}

export async function fetchHeadlines(
  region: 'india' | 'world' | 'all' = 'all',
  limit = 20
): Promise<NewsFeedResponse> {
  const cacheKey = `${region}-${limit}`;
  try {
    const response = await fetch(
      `/api/news/headlines?region=${encodeURIComponent(region)}&limit=${limit}`,
      { cache: 'no-store', headers: { Accept: 'application/json' } }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: NewsFeedResponse = await response.json();
    headlinesCache[cacheKey] = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    console.warn('Failed to fetch headlines, using cache:', error);
    if (headlinesCache[cacheKey]) return headlinesCache[cacheKey].data;
    return { articles: [], source: 'offline', lastUpdated: new Date().toISOString(), count: 0 };
  }
}

export async function fetchCompanyNews(symbol: string, limit = 10): Promise<NewsArticle[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  try {
    const response = await fetch(
      `/api/news/company?symbol=${encodeURIComponent(cleanSymbol)}&limit=${limit}`,
      { cache: 'no-store' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const articles: NewsArticle[] = data.articles || [];
    companyCache[cleanSymbol] = { data: articles, timestamp: Date.now() };
    return articles;
  } catch (error) {
    console.warn(`Failed to fetch company news for ${cleanSymbol}:`, error);
    return companyCache[cleanSymbol]?.data || [];
  }
}

export function useLiveHeadlines(
  region: 'india' | 'world' | 'all' = 'all',
  pollIntervalMs: number = NEWS_POLL_INTERVAL_MS,
  limit = 20
) {
  const [feed, setFeed] = useState<NewsFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchHeadlines(region, limit);
      if (isMounted.current) {
        setFeed(data);
        setLoading(false);
        setError(null);
      }
    } catch (e: any) {
      if (isMounted.current) {
        setError(e?.message || 'Failed to load news');
        setLoading(false);
      }
    }
  }, [region, limit]);

  useEffect(() => {
    isMounted.current = true;
    load();
    const timer = setInterval(load, pollIntervalMs);
    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [load, pollIntervalMs]);

  const liveEvents: GlobalEvent[] = (feed?.articles || []).map(articleToGlobalEvent);

  return { feed, liveEvents, loading, error, refresh: load };
}

export function useCompanyNews(symbol: string, pollIntervalMs: number = NEWS_POLL_INTERVAL_MS, limit = 10) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await fetchCompanyNews(symbol, limit);
      if (isMounted.current) {
        setArticles(data);
        setLastUpdated(new Date().toISOString());
        setLoading(false);
      }
    } catch {
      if (isMounted.current) setLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    load();
    const timer = setInterval(load, pollIntervalMs);
    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [load, pollIntervalMs]);

  const recentNews = articles.map((a) => ({
    title: a.title,
    source: a.source,
    time: a.timeAgo,
    sentiment: a.sentiment,
    url: a.url
  }));

  return { articles, recentNews, loading, lastUpdated, refresh: load };
}
