import React, { useState } from 'react';
import { Cpu, Building2, Zap, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { LiveStockPrice } from '../common/LiveStockPrice';
import { useSectorLive } from '../../lib/useSectorLive';

interface SectorExplorerPageProps {
  onNavigate: (path: string) => void;
}

const PAGE_SIZE = 8;

export const SectorExplorerPage: React.FC<SectorExplorerPageProps> = ({ onNavigate }) => {
  const [selectedSectorId, setSelectedSectorId] = useState('sec-semi');
  const [showAll, setShowAll] = useState(false);

  const { sectors, sectorData, loading, error, refresh } = useSectorLive(selectedSectorId, 45_000);

  const constituents = sectorData?.constituents || [];
  const visible = showAll ? constituents : constituents.slice(0, PAGE_SIZE);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
            <Cpu className="w-4 h-4" />
            Macroeconomic Sector Vulnerability
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">Sector Explorer</h1>
          <p className="text-slate-400 text-xs mt-0.5">Live constituent quotes & dynamic sector risk scores</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedSectorId}
            onChange={(e) => { setSelectedSectorId(e.target.value); setShowAll(false); }}
            className="bg-[#0F1420] border border-[#232A3D] text-slate-100 text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-lg"
          >
            {sectors.map((sec) => (
              <option key={sec.id} value={sec.id}>{sec.name}</option>
            ))}
          </select>
          <button onClick={refresh} className="p-2.5 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !sectorData ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
          <p className="text-xs">Loading live sector data...</p>
        </div>
      ) : error ? (
        <div className="bg-[#0F1420] border border-red-500/30 p-8 rounded-2xl text-center">
          <p className="text-red-400 text-sm font-bold">Data temporarily unavailable</p>
          <button onClick={refresh} className="mt-2 text-xs text-blue-400 hover:underline">Retry</button>
        </div>
      ) : sectorData && (
        <>
          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#232A3D]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white">{sectorData.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{sectorData.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl text-center min-w-[100px]">
                  <div className="text-[10px] text-slate-400 uppercase">Risk Score</div>
                  <div className="text-xl font-extrabold text-red-400">{sectorData.riskScore}<span className="text-[10px] text-slate-500">/100</span></div>
                </div>
                <div className="bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl text-center min-w-[100px]">
                  <div className="text-[10px] text-slate-400 uppercase">Impact</div>
                  <div className="text-xs font-bold text-amber-400 mt-1">{sectorData.marketImpact}</div>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#161B2C] border border-[#232A3D]">
              <span className="text-xs font-bold text-purple-400 uppercase flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Sector Assessment</span>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{sectorData.aiInsight}</p>
              {sectorData.lastUpdated && (
                <p className="text-[10px] text-emerald-500 font-mono mt-2">Live data • {new Date(sectorData.lastUpdated).toLocaleTimeString()} UTC</p>
              )}
            </div>
          </div>

          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              Sector Constituents & Live Prices ({constituents.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-[#232A3D] text-[10px] uppercase text-slate-400 font-mono">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4">Live Quote</th>
                    <th className="py-3 px-4 text-center">Risk</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232A3D]">
                  {visible.map((comp) => (
                    <tr key={comp.ticker} className="hover:bg-[#161B2C]">
                      <td className="py-3.5 px-4 font-bold text-white">{comp.name}</td>
                      <td className="py-3.5 px-4 font-mono text-blue-400">${comp.ticker}</td>
                      <td className="py-3.5 px-4"><LiveStockPrice symbol={comp.ticker} size="sm" showDetails /></td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{comp.riskScore}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button onClick={() => onNavigate(`/companies?symbol=${comp.ticker}`)} className="px-3 py-1 rounded bg-[#161B2C] border border-[#232A3D] hover:border-blue-500 text-[11px] font-semibold">Analyze</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {constituents.length > PAGE_SIZE && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-2 text-xs text-blue-400 hover:underline flex items-center justify-center gap-1"
              >
                {showAll ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Show {constituents.length - PAGE_SIZE} more</>}
              </button>
            )}
          </div>

          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-white uppercase">Sector Vulnerability Vectors</h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {sectorData.keyRisks.map((risk, idx) => (
                <li key={idx} className="p-3 rounded-xl bg-[#161B2C] border border-[#232A3D] flex gap-2">
                  <span className="text-red-400 font-bold">•</span><span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
