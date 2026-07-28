import { useState, useEffect, useCallback, useRef } from 'react';
import { CompanyProfile } from '../types';
import { fetchCompanyProfile } from './watchlistService';

export function useCompanyProfile(ticker: string, pollMs = 8_000) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const mounted = useRef(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!ticker) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setNotFound(false);
    setError(null);
    try {
      const data = await fetchCompanyProfile(ticker);
      if (!mounted.current) return;
      if (!data) {
        setNotFound(true);
        setProfile(null);
      } else {
        setProfile(data);
        setLastFetched(Date.now());
      }
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || 'Unable to fetch live market data. Please try again.');
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => load(true), 4000);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [ticker]);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => load(true), pollMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [load, pollMs]);

  const secondsAgo = lastFetched ? Math.floor((Date.now() - lastFetched) / 1000) : null;

  return { profile, loading, error, notFound, refreshing, secondsAgo, refresh: () => load(true) };
}
