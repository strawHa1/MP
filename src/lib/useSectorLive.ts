import { useState, useEffect, useCallback, useRef } from 'react';
import { SectorLiveData } from '../types';

export function useSectorLive(sectorId: string, pollMs = 45_000) {
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [sectorData, setSectorData] = useState<SectorLiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    fetch('/api/sectors')
      .then((r) => r.json())
      .then((d) => setSectors(d.sectors || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!sectorId) return;
    try {
      const res = await fetch(`/api/sectors/${encodeURIComponent(sectorId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Sector load failed');
      const data = await res.json();
      if (mounted.current) {
        setSectorData(data);
        setLoading(false);
        setError(null);
      }
    } catch (e: any) {
      if (mounted.current) {
        setError(e?.message || 'Failed to load sector');
        setLoading(false);
      }
    }
  }, [sectorId]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    load();
    const timer = setInterval(load, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load, pollMs]);

  return { sectors, sectorData, loading, error, refresh: load };
}
