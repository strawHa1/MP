import React, { useState } from 'react';
import { RefreshCw, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { useImpactData, ImpactSortKey } from '../../lib/useImpactData';
import { StockImpactRecord } from '../../types';
import { ImpactCard } from './ImpactCard';
import { ImpactDetailModal } from './ImpactDetailModal';

interface ImpactOnStocksSectionProps {
  onNavigate: (path: string) => void;
}

export const ImpactOnStocksSection: React.FC<ImpactOnStocksSectionProps> = ({ onNavigate }) => {
  const {
    filteredImpacts,
    isLoading,
    error,
    lastUpdated,
    minutesAgo,
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
    source
  } = useImpactData();

  const [selected, setSelected] = useState<StockImpactRecord | null>(null);

  return (
    <>
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Impact on Stocks
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live news-to-price correlation across tracked companies
            </p>
            {lastUpdated && (
              <p className="text-[10px] text-emerald-400 font-mono mt-1">
                Updated {minutesAgo === 0 ? 'just now' : `${minutesAgo} min ago`}
                {source && source !== 'none' && ` • via ${source}`}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-blue-500/50 text-xs font-bold text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-[#232A3D]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Sort</span>
            {([
              { id: 'severity', label: 'Severity' },
              { id: 'impact', label: '% Impact' },
              { id: 'recent', label: 'Most Recent' }
            ] as { id: ImpactSortKey; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  sortBy === opt.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#161B2C] text-slate-400 border border-[#232A3D] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Sector</span>
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="bg-[#161B2C] border border-[#232A3D] rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Sectors' : s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Region</span>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="bg-[#161B2C] border border-[#232A3D] rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500"
            >
              {regions.map((r) => (
                <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading && filteredImpacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <p className="text-xs">Analyzing live news impact on watchlist...</p>
          </div>
        ) : error && filteredImpacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
            <p className="text-xs font-bold text-amber-400">Data temporarily unavailable</p>
            <p className="text-[11px] text-slate-500 mt-1">{error}</p>
            <button onClick={refresh} className="mt-3 text-xs text-blue-400 hover:underline font-semibold">
              Try again
            </button>
          </div>
        ) : filteredImpacts.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            No impacts match current filters. Try adjusting sector or region.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
            {filteredImpacts.map((record) => (
              <ImpactCard key={record.id} record={record} onClick={() => setSelected(record)} />
            ))}
          </div>
        )}
      </div>

      <ImpactDetailModal
        record={selected}
        onClose={() => setSelected(null)}
        onNavigateCompany={(ticker) => onNavigate(`/companies?symbol=${ticker}`)}
      />
    </>
  );
};
