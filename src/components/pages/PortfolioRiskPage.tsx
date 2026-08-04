import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  TrendingUp,
  ShieldAlert,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Building2,
  BarChart2,
  Sliders
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip } from 'recharts';
import { CompanyRisk, PortfolioHolding } from '../../types';
import { INITIAL_PORTFOLIO } from '../../data/mockData';
import { LiveStockPrice } from '../common/LiveStockPrice';
import { computeInvestmentRiskSignal } from '../../utils/riskSignal';

interface PortfolioRiskPageProps {
  onNavigate: (path: string) => void;
  companies: CompanyRisk[];
  userRiskTolerance?: number;
  initialReviewTicker?: string;
  initialAction?: string;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];

export const PortfolioRiskPage: React.FC<PortfolioRiskPageProps> = ({
  onNavigate,
  companies,
  userRiskTolerance = 55,
  initialReviewTicker = '',
  initialAction = ''
}) => {
  const holdings: PortfolioHolding[] = INITIAL_PORTFOLIO;
  const [selectedReviewTicker, setSelectedReviewTicker] = useState<string | null>(
    initialReviewTicker ? initialReviewTicker.toUpperCase() : null
  );
  const reviewRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (initialReviewTicker) {
      setSelectedReviewTicker(initialReviewTicker.toUpperCase());
    }
  }, [initialReviewTicker]);

  useEffect(() => {
    if (selectedReviewTicker && reviewRowRef.current) {
      reviewRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedReviewTicker]);

  const totalValue = holdings.reduce((sum, h) => {
    const val = h.currentValue ?? (h.shares * (h.avgCost || h.costBasis || 100));
    return sum + val;
  }, 0);

  const avgRiskScore = Math.round(
    holdings.reduce((sum, h) => sum + h.riskScore * h.allocationPct, 0) / 100
  );

  const pieData = holdings.map((h) => ({
    name: h.ticker,
    value: h.allocationPct
  }));

  // Identify any holding that triggers capital loss warning based on userRiskTolerance
  const flaggedHoldings = holdings.map((h) => {
    const comp = companies.find((c) => c.ticker === h.ticker) || {
      ticker: h.ticker,
      name: h.name || h.companyName || h.ticker,
      riskScore: h.riskScore,
      sentimentScore: 40,
      sentimentLabel: 'Bearish' as const,
      sector: 'Technology',
      country: 'USA',
      marketCap: '$1.2T',
      description: '',
      keyRisks: ['Geopolitical supply chain bottleneck'],
      aiSummary: '',
      recentNews: [],
      riskTrend: []
    };
    const signal = computeInvestmentRiskSignal(comp, 2, userRiskTolerance);
    return { holding: h, company: comp, signal };
  }).filter((item) => item.signal.isCapitalLossWarning);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            Institutional Tail-Risk & Hedging
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">Portfolio Risk</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Real-time portfolio shock monitoring & risk tolerance signal calibration ({userRiskTolerance}/100 threshold)
          </p>
        </div>

        <button
          onClick={() => onNavigate('/simulations')}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0"
        >
          Stress Test Portfolio →
        </button>
      </div>

      {selectedReviewTicker && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-100 space-y-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-300">
            {initialAction === 'hedge' ? 'Hedge Plan Review' : initialAction === 'rebalance' ? 'Rebalance Review' : 'Position Review'} — ${selectedReviewTicker}
          </h3>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            {initialAction === 'hedge'
              ? 'Review the highlighted holding below. Confirm sizing before executing a protective put hedge via your broker.'
              : initialAction === 'rebalance'
                ? 'Compare current vs target allocation for the highlighted defensive position.'
                : 'Review the highlighted portfolio position and live risk signal.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate(`/companies?symbol=${selectedReviewTicker}`)}
            className="text-[11px] text-blue-300 hover:underline font-semibold mt-1"
          >
            Open ${selectedReviewTicker} company analysis →
          </button>
        </div>
      )}

      {/* Flagged Position Capital Loss Warning Banner */}
      {flaggedHoldings.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-900 dark:text-rose-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  Portfolio Exposure Warning ({flaggedHoldings.length} Position{flaggedHoldings.length > 1 ? 's' : ''} Flagged)
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 leading-relaxed">
                  Elevated probability of capital drawdown detected. Ticker(s){' '}
                  <strong>{flaggedHoldings.map((f) => `$${f.holding.ticker}`).join(', ')}</strong> exceed your current risk tolerance setting ({userRiskTolerance}/100).
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate(`/companies?symbol=${flaggedHoldings[0].holding.ticker}`)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0"
            >
              <Sliders className="w-4 h-4" /> Review Position ({flaggedHoldings[0].holding.ticker})
            </button>
          </div>
        </div>
      )}

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-5 rounded-2xl shadow-sm dark:shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Portfolio Value</span>
          <div className="text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
            ${Math.round(totalValue).toLocaleString()}
          </div>
          <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> +1.4% ($175,000) Today
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-5 rounded-2xl shadow-sm dark:shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Composite Tail-Risk Score</span>
          <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {avgRiskScore} <span className="text-xs font-normal text-slate-500">/ 100</span>
          </div>
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
            Moderate Threat Concentration (Semiconductors)
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-5 rounded-2xl shadow-sm dark:shadow-lg">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Recommended Hedging</span>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2">
            Buy TSM 60-Day Out-Of-The-Money Put Options
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('/simulations')}>
            Run Hedging Scenario Simulation →
          </div>
        </div>
      </div>

      {/* Main Split Layout: Table Left, Allocation Donut Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-6 rounded-2xl shadow-sm dark:shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Portfolio Holdings & Live Signal Indicators
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#232A3D] text-[10px] uppercase text-slate-500 dark:text-slate-400 font-mono">
                  <th className="py-3 px-3">Asset</th>
                  <th className="py-3 px-3">Allocation</th>
                  <th className="py-3 px-3">Live Quote</th>
                  <th className="py-3 px-3 text-center">Risk Signal</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#232A3D]">
                {holdings.map((h) => {
                  const companyName = h.name || h.companyName || h.ticker;
                  const val = h.currentValue ?? (h.shares * (h.avgCost || h.costBasis || 100));
                  const comp = companies.find((c) => c.ticker === h.ticker) || {
                    ticker: h.ticker,
                    name: companyName,
                    riskScore: h.riskScore,
                    sentimentScore: 40,
                    sentimentLabel: 'Bearish' as const,
                    sector: 'Technology',
                    country: 'USA',
                    marketCap: '$1.2T',
                    description: '',
                    keyRisks: ['Supply chain vulnerability'],
                    aiSummary: '',
                    recentNews: [],
                    riskTrend: []
                  };
                  const signal = computeInvestmentRiskSignal(comp, 2, userRiskTolerance);

                  const isHighlighted = selectedReviewTicker === h.ticker;

                  return (
                    <tr
                      key={h.id}
                      ref={isHighlighted ? reviewRowRef : undefined}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-blue-500/10 ring-1 ring-blue-500/40'
                          : 'hover:bg-slate-50 dark:hover:bg-[#161B2C]'
                      }`}
                    >
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{companyName}</div>
                        <div className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">${h.ticker}</div>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-200">
                        {h.allocationPct}%
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">${Math.round(val).toLocaleString()}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <LiveStockPrice symbol={h.ticker} size="sm" showDetails={true} />
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${
                          signal.label === 'Favorable'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : signal.label === 'Neutral-Hold'
                            ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-400'
                            : signal.label === 'Caution'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400'
                        }`}>
                          {signal.label} ({signal.compositeScore})
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => onNavigate(`/companies?symbol=${h.ticker}`)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                            signal.isCapitalLossWarning
                              ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-sm'
                              : 'bg-slate-100 dark:bg-[#161B2C] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#232A3D] hover:bg-slate-200'
                          }`}
                        >
                          {signal.isCapitalLossWarning ? 'Review Position' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Allocation Donut Chart */}
        <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-6 rounded-2xl shadow-sm dark:shadow-xl flex flex-col items-center justify-between">
          <div className="w-full text-left">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Sector Weight Allocation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Asset distribution by ticker</p>
          </div>

          <div className="h-56 w-full my-4">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#161B2C', borderColor: '#232A3D', borderRadius: '12px', color: '#FFF' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full space-y-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
            {pieData.map((item, idx) => (
              <div key={item.name} className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  ${item.name}
                </span>
                <span className="font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
