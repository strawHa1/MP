import React, { useState } from 'react';
import { Map, Globe2, Filter, Loader2, RefreshCw } from 'lucide-react';
import { LiveCountryRisk } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';
import { useCountryRisk } from '../../lib/useCountryRisk';

interface WorldMapPageProps {
  onNavigate: (path: string) => void;
}

export const WorldMapPage: React.FC<WorldMapPageProps> = ({ onNavigate }) => {
  const { countries, lastUpdated, loading, error, changedIds, refresh } = useCountryRisk();
  const [selectedCountry, setSelectedCountry] = useState<LiveCountryRisk | null>(null);
  const [filterLevel, setFilterLevel] = useState('all');

  const filtered = countries.filter((c) => {
    if (filterLevel === 'all') return true;
    return c.riskLevel.toLowerCase() === filterLevel.toLowerCase();
  });

  const active = selectedCountry || filtered[0] || null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
            <Map className="w-4 h-4" />
            GIS Geopolitical & Maritime Risk Heatmap
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">World Risk Map</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Live regional risk from news & impact pipeline
            {lastUpdated && ` • Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-[#0F1420] border border-[#232A3D] text-slate-100 text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={refresh} className="p-2 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && countries.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
          <p className="text-xs">Computing live regional risk scores...</p>
        </div>
      ) : error && countries.length === 0 ? (
        <div className="bg-[#0F1420] border border-red-500/30 p-8 rounded-2xl text-center">
          <p className="text-red-400 font-bold text-sm">Data temporarily unavailable</p>
          <button onClick={refresh} className="mt-2 text-xs text-blue-400 hover:underline">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0F1420] border border-[#232A3D] rounded-2xl p-6 shadow-2xl min-h-[480px] flex flex-col">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-[#232A3D] pb-3">
              <span className="flex items-center gap-2"><Globe2 className="w-4 h-4 text-blue-400" /> {filtered.length} tracked regions</span>
              <span className="text-emerald-500">Auto-refresh 5m</span>
            </div>

            <div className="my-auto py-8 relative">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:20px_20px]" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10 relative max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {filtered.map((cnt) => {
                  const isSelected = active?.id === cnt.id;
                  const justChanged = changedIds.has(cnt.id);
                  let borderColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
                  if (cnt.riskLevel === 'Critical') borderColor = 'border-red-500/50 bg-red-500/15 text-red-300';
                  else if (cnt.riskLevel === 'High') borderColor = 'border-amber-500/40 bg-amber-500/10 text-amber-300';
                  else if (cnt.riskLevel === 'Medium') borderColor = 'border-blue-500/30 bg-blue-500/10 text-blue-300';

                  return (
                    <div
                      key={cnt.id}
                      onClick={() => setSelectedCountry(cnt)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${borderColor} ${
                        isSelected ? 'ring-2 ring-purple-500 scale-[1.02]' : ''
                      } ${justChanged ? 'animate-pulse ring-2 ring-yellow-400/60' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{cnt.flag}</span>
                        <span className="text-xs font-mono font-bold">{cnt.riskScore}/100</span>
                      </div>
                      <div className="text-sm font-extrabold text-white mt-1.5 line-clamp-1">{cnt.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{cnt.eventsCount} events</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl">
            {active ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{active.flag}</span>
                    <div>
                      <h3 className="text-xl font-extrabold text-white">{active.name}</h3>
                      <div className="text-xs text-slate-400 font-mono">{active.region}</div>
                    </div>
                  </div>
                  <SeverityBadge severity={active.riskLevel.toLowerCase()} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase">Risk Score</span>
                    <div className="text-xl font-extrabold text-red-400 mt-0.5">{active.riskScore}/100</div>
                    {active.scoreChanged && active.previousScore != null && (
                      <div className="text-[10px] text-amber-400 mt-0.5">was {active.previousScore}</div>
                    )}
                  </div>
                  <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase">Active Events</span>
                    <div className="text-xl font-extrabold text-blue-400 mt-0.5">{active.eventsCount}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">Regional Risk Vectors</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {active.keyRisks.slice(0, 5).map((risk, idx) => (
                      <li key={idx} className="p-2.5 rounded-lg bg-[#161B2C] border border-[#232A3D] flex gap-2">
                        <span className="text-red-400 font-bold shrink-0">•</span>
                        <span className="line-clamp-2">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => onNavigate(`/events?country=${encodeURIComponent(active.isoCode)}&region=${encodeURIComponent(active.region)}`)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xs"
                >
                  View Country Events Feed →
                </button>
              </div>
            ) : (
              <p className="text-center text-slate-400 text-xs py-12">Select a country to view its risk profile.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
