import React, { useState } from 'react';
import {
  Cpu,
  Flame,
  Shield,
  Landmark,
  Server,
  Building2,
  Zap,
  ArrowRight
} from 'lucide-react';
import { SectorRisk, CompanyRisk } from '../../types';
import { INITIAL_SECTORS } from '../../data/mockData';
import { LiveStockPrice } from '../common/LiveStockPrice';
import { SeverityBadge } from '../common/SeverityBadge';

interface SectorExplorerPageProps {
  onNavigate: (path: string) => void;
  companies: CompanyRisk[];
}

export const SectorExplorerPage: React.FC<SectorExplorerPageProps> = ({ onNavigate, companies }) => {
  const [selectedSectorId, setSelectedSectorId] = useState<string>(INITIAL_SECTORS[0].id);

  const selectedSector =
    INITIAL_SECTORS.find((s) => s.id === selectedSectorId) || INITIAL_SECTORS[0];

  const topSectorCompanies = companies.filter((c) =>
    selectedSector.topTickers.includes(c.ticker)
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
            <Cpu className="w-4 h-4" />
            Macroeconomic Sector Vulnerability
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">Sector Explorer</h1>
          <p className="text-slate-400 text-xs mt-0.5">Analyze risk propagation across global industry sectors</p>
        </div>

        {/* Sector Dropdown Selector */}
        <select
          value={selectedSectorId}
          onChange={(e) => setSelectedSectorId(e.target.value)}
          className="bg-[#0F1420] border border-[#232A3D] text-slate-100 text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-lg"
        >
          {INITIAL_SECTORS.map((sec) => (
            <option key={sec.id} value={sec.id}>
              {sec.name} (Risk: {sec.riskScore}/100)
            </option>
          ))}
        </select>
      </div>

      {/* Selected Sector Header Card */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#232A3D]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{selectedSector.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{selectedSector.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl text-center min-w-[100px]">
              <div className="text-[10px] text-slate-400 uppercase">Risk Score</div>
              <div className="text-xl font-extrabold text-red-400 mt-0.5">{selectedSector.riskScore} <span className="text-[10px] text-slate-500">/100</span></div>
            </div>

            <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl text-center min-w-[100px]">
              <div className="text-[10px] text-slate-400 uppercase">Impact Level</div>
              <div className="text-xs font-bold text-amber-400 mt-1">{selectedSector.marketImpact}</div>
            </div>
          </div>
        </div>

        {/* AI Insight Card */}
        <div className="p-4 rounded-xl bg-[#161B2C] border border-[#232A3D] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Sector Risk Assessment
            </span>
            <button onClick={() => onNavigate('/reports')} className="text-[11px] text-blue-400 hover:underline font-semibold">
              View Full Report →
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {selectedSector.aiInsight}
          </p>
        </div>
      </div>

      {/* Top Companies Table with Live Stock Prices */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" /> Top Sector Constituent Companies & Live Prices
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-[#232A3D] text-[10px] uppercase text-slate-400 font-mono">
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Ticker</th>
                <th className="py-3 px-4">Live Stock Quote</th>
                <th className="py-3 px-4 text-center">Risk Score</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232A3D]">
              {topSectorCompanies.map((comp) => (
                <tr key={comp.ticker} className="hover:bg-[#161B2C] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">{comp.name}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-400">${comp.ticker}</td>
                  <td className="py-3.5 px-4">
                    <LiveStockPrice symbol={comp.ticker} size="sm" showDetails={true} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      {comp.riskScore} / 100
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onNavigate(`/companies?symbol=${comp.ticker}`)}
                      className="px-3 py-1 rounded bg-[#161B2C] border border-[#232A3D] hover:border-slate-500 text-slate-200 font-semibold text-[11px]"
                    >
                      Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Risks Bullet List */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sector Vulnerability Vectors</h3>
        <ul className="space-y-2 text-xs text-slate-300">
          {selectedSector.keyRisks.map((risk, idx) => (
            <li key={idx} className="p-3 rounded-xl bg-[#161B2C] border border-[#232A3D] flex items-center gap-3">
              <span className="text-red-400 font-bold">•</span>
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
