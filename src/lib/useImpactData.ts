import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ImpactStoreState, StockImpactRecord, ImpactSeverity } from '../types';

const PRICE_POLL_MS = 30_000;
const DATA_POLL_MS = 120_000;

export type ImpactSortKey = 'severity' | 'impact' | 'recent';
export type ImpactFilterSector = 'all' | string;
export type ImpactFilterRegion = 'all' | string;

async function fetchImpactState(): Promise<ImpactStoreState> {
  const res = await fetch('/api/impact', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function triggerImpactRefresh(): Promise<ImpactStoreState> {
  const res = await fetch('/api/impact/refresh', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Refresh failed');
  return data;
}

const SEVERITY_ORDER: Record<ImpactSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export function useImpactData() {
  const [state, setState] = useState<ImpactStoreState>({
    impactedCompanies: [],
    lastUpdated: null,
    isLoading: true,
    error: null,
    source: 'none'
  });
  const [sortBy, setSortBy] = useState<ImpactSortKey>('severity');
  const [filterSector, setFilterSector] = useState<ImpactFilterSector>('all');
  const [filterRegion, setFilterRegion] = useState<ImpactFilterRegion>('all');
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchImpactState();
      if (isMounted.current) {
        setState(data);
      }
    } catch (e: any) {
      if (isMounted.current) {
        setState((prev) => ({ ...prev, isLoading: false, error: e?.message || 'Failed to load impact data' }));
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await triggerImpactRefresh();
      if (isMounted.current) setState(data);
    } catch (e: any) {
      if (isMounted.current) {
        setState((prev) => ({ ...prev, error: e?.message || 'Refresh failed' }));
      }
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    load();
    const dataTimer = setInterval(load, DATA_POLL_MS);
    const priceTimer = setInterval(load, PRICE_POLL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(dataTimer);
      clearInterval(priceTimer);
    };
  }, [load]);

  const sectors = useMemo(
    () => ['all', ...new Set(state.impactedCompanies.map((r) => r.sector))],
    [state.impactedCompanies]
  );

  const regions = useMemo(
    () => ['all', ...new Set(state.impactedCompanies.map((r) => r.region))],
    [state.impactedCompanies]
  );

  const filteredAndSorted: StockImpactRecord[] = useMemo(() => {
    let list = [...state.impactedCompanies];
    if (filterSector !== 'all') list = list.filter((r) => r.sector === filterSector);
    if (filterRegion !== 'all') list = list.filter((r) => r.region === filterRegion);

    list.sort((a, b) => {
      if (sortBy === 'severity') return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
      if (sortBy === 'impact') return Math.abs(b.actualChangePct) - Math.abs(a.actualChangePct);
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return list;
  }, [state.impactedCompanies, sortBy, filterSector, filterRegion]);

  const minutesAgo = state.lastUpdated
    ? Math.max(0, Math.floor((Date.now() - new Date(state.lastUpdated).getTime()) / 60000))
    : null;

  return {
    ...state,
    filteredImpacts: filteredAndSorted,
    sortBy,
    setSortBy,
    filterSector,
    setFilterSector,
    filterRegion,
    setFilterRegion,
    sectors,
    regions,
    refresh,
    refreshing,
    minutesAgo,
    reload: load
  };
}
