import { useState, useEffect, useCallback, useRef } from 'react';

export interface DashboardInsight {
  id: string;
  title: string;
  body: string;
  relatedTickers: string[];
  relatedEventTitle?: string;
}

export interface RecommendedActionItem {
  id: string;
  type: 'execute' | 'review';
  title: string;
  subtitle: string;
  ticker: string;
  rationale: string;
  targetAllocationPct?: number;
  currentAllocationPct?: number;
  relatedHeadline?: string;
  hedgeInstrument?: string;
}

export interface DashboardIntelligence {
  insights: DashboardInsight[];
  actions: RecommendedActionItem[];
  source: 'gemini' | 'rules';
  generatedAt: string | null;
  portfolioTickers: string[];
  liveEventCount: number;
  loading: boolean;
  error: string | null;
}

const POLL_MS = 120_000;

export function useDashboardIntelligence() {
  const [data, setData] = useState<DashboardIntelligence>({
    insights: [],
    actions: [],
    source: 'rules',
    generatedAt: null,
    portfolioTickers: [],
    liveEventCount: 0,
    loading: true,
    error: null
  });
  const mounted = useRef(true);

  const load = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/dashboard/intelligence${force ? '?refresh=true' : ''}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!mounted.current) return;
      setData({
        insights: json.insights || [],
        actions: json.actions || [],
        source: json.source || 'rules',
        generatedAt: json.generatedAt || null,
        portfolioTickers: json.portfolioTickers || [],
        liveEventCount: json.liveEventCount || 0,
        loading: false,
        error: null
      });
    } catch (e: any) {
      if (mounted.current) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: e?.message || 'Failed to load intelligence'
        }));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => load(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  return { ...data, refresh: () => load(true) };
}
