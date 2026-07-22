import React, { useState } from 'react';
import {
  Map,
  Globe2,
  Filter,
  ShieldAlert,
  ChevronRight,
  X,
  Activity
} from 'lucide-react';
import { CountryRisk } from '../../types';
import { INITIAL_COUNTRIES } from '../../data/mockData';
import { SeverityBadge } from '../common/SeverityBadge';

interface WorldMapPageProps {
  onNavigate: (path: string) => void;
}

export const WorldMapPage: React.FC<WorldMapPageProps> = ({ onNavigate }) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryRisk | null>(INITIAL_COUNTRIES[0]);
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const filteredCountries = INITIAL_COUNTRIES.filter((cnt) => {
    if (filterLevel === 'all') return true;
    return cnt.riskLevel.toLowerCase() === filterLevel.toLowerCase();
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
            <Map className="w-4 h-4" />
            GIS Geopolitical & Maritime Risk Heatmap
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">World Risk Map</h1>
          <p className="text-slate-400 text-xs mt-0.5">Interactive territorial threat evaluation and regional event concentration</p>
        </div>

        {/* Risk Level Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-[#0F1420] border border-[#232A3D] text-slate-100 text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer shadow-lg"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Main Map Interactive Canvas & Side Panel Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive GIS Globe Display */}
        <div className="lg:col-span-2 bg-[#0F1420] border border-[#232A3D] rounded-2xl p-6 shadow-2xl relative min-h-[480px] flex flex-col justify-between overflow-hidden">
          {/* Top Bar Legend */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-[#232A3D] pb-3 z-10">
            <span className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-blue-400" /> GIS Threat Spectrum
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> High/Critical</span>
            </div>
          </div>

          {/* Interactive Territorial Map Nodes */}
          <div className="my-auto py-12 relative flex items-center justify-center">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:20px_20px]" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 z-10 w-full max-w-xl">
              {filteredCountries.map((cnt) => {
                const isSelected = selectedCountry?.id === cnt.id;
                let borderColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
                if (cnt.riskLevel === 'Critical') borderColor = 'border-red-500/50 bg-red-500/15 text-red-300 animate-pulse';
                else if (cnt.riskLevel === 'High') borderColor = 'border-amber-500/40 bg-amber-500/10 text-amber-300';
                else if (cnt.riskLevel === 'Medium') borderColor = 'border-blue-500/30 bg-blue-500/10 text-blue-300';

                return (
                  <div
                    key={cnt.id}
                    onClick={() => setSelectedCountry(cnt)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-105 shadow-lg ${borderColor} ${
                      isSelected ? 'ring-2 ring-purple-500 scale-105' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{cnt.flag}</span>
                      <span className="text-xs font-mono font-bold">{cnt.riskScore}/100</span>
                    </div>
                    <div className="text-sm font-extrabold text-white mt-2">{cnt.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{cnt.region}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#232A3D] text-xs font-mono text-slate-500 flex justify-between">
            <span>TERRITORIAL GEOPOLITICAL LAYER ACTIVE</span>
            <span>CLICK COUNTRY FOR PROFILES</span>
          </div>
        </div>

        {/* Selected Country Detail Side Panel */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-6">
          {selectedCountry ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedCountry.flag}</span>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">{selectedCountry.name}</h3>
                    <div className="text-xs text-slate-400 font-mono">{selectedCountry.region}</div>
                  </div>
                </div>
                <SeverityBadge severity={selectedCountry.riskLevel.toLowerCase()} size="sm" />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase">Risk Score</span>
                  <div className="text-xl font-extrabold text-red-400 mt-0.5">{selectedCountry.riskScore} / 100</div>
                </div>

                <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase">Active Events</span>
                  <div className="text-xl font-extrabold text-blue-400 mt-0.5">{selectedCountry.eventsCount} Shocks</div>
                </div>
              </div>

              {/* Key Risks */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Regional Risk Vectors</h4>
                <ul className="space-y-2 text-xs text-slate-300">
                  {selectedCountry.keyRisks.map((risk, idx) => (
                    <li key={idx} className="p-2.5 rounded-lg bg-[#161B2C] border border-[#232A3D] flex items-center gap-2">
                      <span className="text-red-400 font-bold">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onNavigate(`/events?region=${encodeURIComponent(selectedCountry.region)}`)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                View Country Events Feed →
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select a country on the GIS map to view risk profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
