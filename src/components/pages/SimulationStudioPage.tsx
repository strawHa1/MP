import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Zap,
  TrendingDown,
  Building2,
  Clock,
  Shield,
  Activity,
  Layers,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { SimulationResult } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';

interface SimulationStudioPageProps {
  initialScenario?: string;
  onNavigate: (path: string) => void;
}

const PRESET_SCENARIOS = [
  'China bans Rare Earth Export Licenses',
  'Naval Blockade of Taiwan Strait Container Shipping',
  'Strait of Hormuz Tanker Transit Closure',
  'Panama Canal Water Level Draft Cut by 50%',
  'European Power Grid Cyberattack Sabotage'
];

export const SimulationStudioPage: React.FC<SimulationStudioPageProps> = ({
  initialScenario,
  onNavigate
}) => {
  const [scenarioInput, setScenarioInput] = useState(
    initialScenario || PRESET_SCENARIOS[0]
  );
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'companies' | 'supplyChain' | 'timeline'>('results');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>({
    id: 'sim-default',
    scenarioText: scenarioInput,
    marketImpactPct: -5.2,
    affectedCompaniesCount: 42,
    recoveryTimeRange: '45 - 90 Days',
    probabilityPct: 74,
    aiSummary: 'Simulation analysis predicts significant supply chain friction resulting in immediate margin compression for regional hardware manufacturers and transportation choke points.',
    affectedTickers: [
      { ticker: 'TSM', name: 'TSMC', impactPct: -8.8, riskLevel: 'Critical' },
      { ticker: 'NVDA', name: 'NVIDIA', impactPct: -6.4, riskLevel: 'High' },
      { ticker: 'AAPL', name: 'Apple', impactPct: -3.8, riskLevel: 'Medium' },
      { ticker: 'XOM', name: 'Exxon Mobil', impactPct: 4.2, riskLevel: 'Positive' }
    ],
    supplyChainRisks: [
      'Maritime insurance freight premiums spike +140%',
      'Air cargo volume re-routed via secondary regional hubs',
      '30-day inventory buffers depleted across Tier-1 suppliers'
    ],
    marketImpactTimeline: [
      { day: 'Day 1', S_AND_P: -1.2, TechSector: -2.8, EnergySector: 1.5 },
      { day: 'Day 7', S_AND_P: -3.4, TechSector: -5.8, EnergySector: 3.2 },
      { day: 'Day 30', S_AND_P: -5.2, TechSector: -8.8, EnergySector: 5.1 },
      { day: 'Day 60', S_AND_P: -2.1, TechSector: -4.1, EnergySector: 2.8 },
      { day: 'Day 90', S_AND_P: -0.5, TechSector: -1.2, EnergySector: 1.0 }
    ]
  });

  const handleRunSimulation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scenarioInput.trim()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioInput })
      });

      if (response.ok) {
        const data: SimulationResult = await response.json();
        setSimulationResult(data);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold uppercase tracking-wider">
          <FileSpreadsheet className="w-4 h-4" />
          Generative AI "What-If" Market Risk Engine
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">Simulation Studio</h1>
        <p className="text-slate-400 text-xs mt-0.5">Test custom geopolitical, energy, or trade scenarios to quantify market shocks</p>
      </div>

      {/* Scenario Input Bar & Presets */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
        <form onSubmit={handleRunSimulation} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={scenarioInput}
            onChange={(e) => setScenarioInput(e.target.value)}
            placeholder="Type custom scenario (e.g., China bans Rare Earth Exports...)"
            className="flex-1 bg-[#161B2C] border border-[#232A3D] rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition-colors"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:to-pink-500 text-white font-bold text-xs shadow-xl shadow-purple-500/25 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Executing Simulation...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300" />
                Run Simulation
              </>
            )}
          </button>
        </form>

        {/* Preset Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 custom-scrollbar">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 font-mono">
            Presets:
          </span>
          {PRESET_SCENARIOS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setScenarioInput(preset);
              }}
              className="text-[11px] bg-[#161B2C] hover:bg-slate-800 text-slate-300 border border-[#232A3D] px-2.5 py-1 rounded-lg shrink-0 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Simulation Results Section */}
      {simulationResult && (
        <div className="space-y-6">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Est. Market Impact</span>
              <div className="text-2xl font-black font-mono text-red-400 mt-1">
                {simulationResult.marketImpactPct}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">S&P 500 Projected Index Drawdown</div>
            </div>

            <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Affected Companies</span>
              <div className="text-2xl font-black font-mono text-purple-400 mt-1">
                {simulationResult.affectedCompaniesCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Entities in direct exposure path</div>
            </div>

            <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recovery Duration</span>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                {simulationResult.recoveryTimeRange}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Estimated supply normalization window</div>
            </div>

            <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Probability Index</span>
              <div className="text-2xl font-black font-mono text-blue-400 mt-1">
                {simulationResult.probabilityPct}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Confidence probability score</div>
            </div>
          </div>

          {/* AI Reasoning Block */}
          <div className="p-5 rounded-2xl bg-[#0F1420] border border-[#232A3D] shadow-xl space-y-2">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> AI Generative Analysis & Reasoning
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {simulationResult.aiSummary}
            </p>
          </div>

          {/* Result Tabs */}
          <div className="flex items-center gap-2 border-b border-[#232A3D] pb-1 overflow-x-auto">
            {[
              { id: 'results', label: 'Timeline Trajectory' },
              { id: 'companies', label: 'Affected Companies' },
              { id: 'supplyChain', label: 'Supply Chain Bottlenecks' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Timeline Chart */}
          {activeTab === 'results' && (
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Market Impact Trajectory Over Time (Days)</h3>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulationResult.marketImpactTimeline}>
                    <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#161B2C', borderColor: '#232A3D', borderRadius: '12px', color: '#FFF' }}
                    />
                    <Area type="monotone" dataKey="TechSector" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} name="Tech Sector %" />
                    <Area type="monotone" dataKey="S_AND_P" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="S&P 500 %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tab 2: Affected Companies Grid */}
          {activeTab === 'companies' && (
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Most Impacted Tickers</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {simulationResult.affectedTickers.map((tick) => (
                  <div
                    key={tick.ticker}
                    onClick={() => onNavigate(`/companies?symbol=${tick.ticker}`)}
                    className="p-4 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-slate-500 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{tick.name}</div>
                      <div className="text-[10px] font-mono font-bold text-blue-400">${tick.ticker}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold font-mono ${tick.impactPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {tick.impactPct}%
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase">{tick.riskLevel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Supply Chain Risks */}
          {activeTab === 'supplyChain' && (
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Supply Chain Transmission Factors</h3>

              <ul className="space-y-2 text-xs text-slate-300">
                {simulationResult.supplyChainRisks.map((risk, idx) => (
                  <li key={idx} className="p-3 rounded-xl bg-[#161B2C] border border-[#232A3D] flex items-center gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
