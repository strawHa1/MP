import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveCountryRisk } from '../types';

const POLL_MS = 5 * 60 * 1000;

export function useCountryRisk() {
  const [countries, setCountries] = useState<LiveCountryRisk[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const mounted = useRef(true);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(`/api/countries/risk${force ? '?refresh=true' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load country risk');
      const data = await res.json();
      if (!mounted.current) return;
      const changed = new Set<string>(
        (data.countries || []).filter((c: LiveCountryRisk) => c.scoreChanged).map((c: LiveCountryRisk) => c.id)
      );
      setCountries(data.countries || []);
      setLastUpdated(data.lastUpdated);
      setChangedIds(changed);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      if (changed.size > 0) {
        setTimeout(() => mounted.current && setChangedIds(new Set()), 4000);
      }
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || 'Country risk unavailable');
        setLoading(false);
        setRefreshing(false);
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

  return { countries, lastUpdated, loading, refreshing, error, changedIds, refresh: () => load(true) };
}
