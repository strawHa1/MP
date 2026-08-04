import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalEvent, AlertItem, LiveCountryRisk } from '../types';
import { fetchHeadlines, NEWS_POLL_INTERVAL_MS } from './newsService';

const POLL_MS = NEWS_POLL_INTERVAL_MS;

export interface TrendPoint {
  day: string;
  score: number;
  date?: string;
  source?: string;
}

export interface DashboardSentiment {
  bearishPct: number;
  neutralPct: number;
  bullishPct: number;
  gaugeScore: number;
  label: string;
}

export interface DashboardStats {
  globalRiskScore: number;
  globalRiskSeverity: 'critical' | 'high' | 'medium' | 'low';
  scoreDelta: number | null;
  activeBlackSwans: number;
  liveEventsToday: number;
  criticalFocus: string;
  companiesAtRisk: number;
  highRiskTickers: string[];
  atRiskTickers: string[];
  criticalAlerts: number;
  topCriticalTitle: string;
  sentiment: DashboardSentiment;
  trend: TrendPoint[];
  trendHigh: number;
  trendSnapshotCount: number;
  topCountries: LiveCountryRisk[];
  lastUpdated: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

function severityFromScore(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function sentimentFromScore(score: number): DashboardSentiment['label'] {
  if (score >= 55) return 'BULLISH SENTIMENT';
  if (score <= 40) return 'BEARISH SENTIMENT';
  return 'NEUTRAL SENTIMENT';
}

function computeSentiment(articles: { sentiment: string }[]): DashboardSentiment {
  if (articles.length === 0) {
    return { bearishPct: 0, neutralPct: 100, bullishPct: 0, gaugeScore: 50, label: 'NEUTRAL SENTIMENT' };
  }
  let neg = 0;
  let neu = 0;
  let pos = 0;
  for (const a of articles) {
    if (a.sentiment === 'negative') neg++;
    else if (a.sentiment === 'positive') pos++;
    else neu++;
  }
  const total = articles.length;
  const bearishPct = Math.round((neg / total) * 100);
  const neutralPct = Math.round((neu / total) * 100);
  const bullishPct = Math.round((pos / total) * 100);
  const gaugeScore = Math.round(bullishPct + neutralPct * 0.5);
  return { bearishPct, neutralPct, bullishPct, gaugeScore, label: sentimentFromScore(gaugeScore) };
}

export function useDashboardStats(events: GlobalEvent[], alerts: AlertItem[]) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      try {
        const [countryRes, impactRes, headlineFeed, trendRes] = await Promise.all([
          fetch(`/api/countries/risk${force ? '?refresh=true' : ''}`, { cache: 'no-store' }),
          fetch('/api/impact', { cache: 'no-store' }),
          fetchHeadlines('all', 30),
          fetch(`/api/dashboard/trend${force ? '?refresh=true' : ''}`, { cache: 'no-store' })
        ]);

        if (!countryRes.ok || !impactRes.ok) throw new Error('Failed to load dashboard data');

        const countryData = await countryRes.json();
        const impactData = await impactRes.json();
        const trendData = trendRes.ok ? await trendRes.json() : { points: [], snapshotCount: 0 };
        const countries: LiveCountryRisk[] = countryData.countries || [];
        const articles = headlineFeed.articles || [];

        const globalRiskScore =
          countries.length > 0
            ? Math.round(countries.reduce((s, c) => s + c.riskScore, 0) / countries.length)
            : 50;

        const trend: TrendPoint[] = trendData.points || [];
        const trendHigh = trend.length > 0 ? Math.max(...trend.map((t) => t.score)) : globalRiskScore;

        const weekAgoPoint = trend.length >= 2 ? trend[Math.max(0, trend.length - 8)] : null;
        const scoreDelta = weekAgoPoint ? globalRiskScore - weekAgoPoint.score : null;

        const activeBlackSwans = events.filter(
          (e) => e.severity === 'high' || e.severity === 'critical'
        ).length;
        const liveEventsToday = events.filter((e) => e.isLive).length;

        const topCountries = [...countries].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
        const criticalFocus =
          topCountries.length > 0
            ? topCountries.map((c) => c.name.split(' ')[0]).join(' & ')
            : 'Monitoring global feeds';

        const impacted = impactData.impactedCompanies || [];
        const atRiskTickers = [...new Set(impacted.map((r: { ticker: string }) => r.ticker))] as string[];
        const highRiskTickers = atRiskTickers.slice(0, 3);

        const criticalEvents = events.filter((e) => e.severity === 'critical');
        const unreadCriticalAlerts = alerts.filter((a) => !a.read && a.severity === 'critical');
        const criticalAlerts = criticalEvents.length + unreadCriticalAlerts.length;
        const topCriticalTitle =
          criticalEvents[0]?.title || unreadCriticalAlerts[0]?.title || events[0]?.title || 'No critical alerts';

        const sentiment = computeSentiment(articles);
        const lastUpdated = countryData.lastUpdated || headlineFeed.lastUpdated || impactData.lastUpdated;

        if (!mounted.current) return;

        setStats({
          globalRiskScore,
          globalRiskSeverity: severityFromScore(globalRiskScore),
          scoreDelta,
          activeBlackSwans,
          liveEventsToday,
          criticalFocus,
          companiesAtRisk: atRiskTickers.length,
          highRiskTickers,
          atRiskTickers,
          criticalAlerts,
          topCriticalTitle,
          sentiment,
          trend,
          trendHigh,
          trendSnapshotCount: trendData.snapshotCount ?? trend.length,
          topCountries,
          lastUpdated,
          loading: false,
          refreshing: false,
          error: null
        });
        setLoading(false);
        setRefreshing(false);
        setError(null);
      } catch (e: any) {
        if (mounted.current) {
          setError(e?.message || 'Dashboard data unavailable');
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [events, alerts]
  );

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => load(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  return {
    stats,
    loading,
    refreshing,
    error,
    refresh: () => load(true)
  };
}
