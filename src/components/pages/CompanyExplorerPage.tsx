import React, { useState } from 'react';
import {
  Search,
  Building2,
  TrendingUp,
  Activity,
  Globe2,
  ExternalLink,
  Zap,
  BarChart2,
  CheckCircle2,
  Newspaper
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { CompanyRisk } from '../../types';
import { LiveStockPrice } from '../common/LiveStockPrice';
import { RiskGauge } from '../common/RiskGauge';
import { SeverityBadge } from '../common/SeverityBadge';
import { InvestmentRiskSignalCard } from '../common/InvestmentRiskSignalCard';

interface CompanyExplorerPageProps {
  initialSymbol?: string;
  onNavigate: (path: string) => void;
  companies: CompanyRisk[];
  userRiskTolerance?: number;
  theme?: 'light' | 'dark';
}

export const CompanyExplorerPage: React.FC<CompanyExplorerPageProps> = ({
  initialSymbol = 'NVDA',
  onNavigate,
  companies,
  userRiskTolerance = 55,
  theme = 'light'
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>(initialSymbol.toUpperCase());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'signal' | 'overview' | 'risks' | 'news' | 'ai'>('signal');

  const selectedCompany =
    companies.find((c) => c.ticker === selectedTicker) || companies[0];

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header & Global Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            Corporate Risk & Market Intelligence
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Company Explorer
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Real-time equity quote streaming, quantitative risk signals, and geopolitical exposure scoring
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company or ticker (NVDA, AAPL...)"
            className="w-full bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-sm transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Quick Company Picker Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {filteredCompanies.map((comp) => (
          <button
            key={comp.ticker}
            onClick={() => setSelectedTicker(comp.ticker)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shrink-0 border ${
              selectedTicker === comp.ticker
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-md'
                : 'bg-white dark:bg-[#0F1420] text-slate-700 dark:text-slate-400 border-slate-200 dark:border-[#232A3D] hover:text-slate-900 dark:hover:text-slate-200 shadow-sm'
            }`}
          >
            <span>${comp.ticker}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans ${
              comp.riskScore >= 75
                ? 'bg-rose-100 text-rose-700 dark:bg-red-500/20 dark:text-red-400'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
            }`}>
              {comp.riskScore}
            </span>
          </button>
        ))}
      </div>

      {/* Primary Feature: Investment Risk Signal Card + Live Stock Price Block */}
      <InvestmentRiskSignalCard
        company={selectedCompany}
        activeEventsCount={2}
        userRiskTolerance={userRiskTolerance}
        onNavigate={onNavigate}
        theme={theme}
      />

      {/* Detailed Selected Company Panel */}
      <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-6 rounded-2xl shadow-sm dark:shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-[#232A3D]">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-[#161B2C] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#232A3D] px-2.5 py-1 rounded-lg">
                NASDAQ: {selectedCompany.ticker}
              </span>
              <SeverityBadge
                severity={selectedCompany.riskScore >= 75 ? 'critical' : selectedCompany.riskScore >= 55 ? 'high' : 'medium'}
                size="md"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {selectedCompany.sector} • {selectedCompany.country}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {selectedCompany.name}
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              {selectedCompany.description}
            </p>
          </div>

          {/* Live Stock Quote Widget Box */}
          <div className="bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-4 rounded-xl shrink-0 min-w-[240px] flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
              REAL-TIME EQUITY PRICE
            </span>
            <LiveStockPrice symbol={selectedCompany.ticker} size="lg" showDetails={true} />
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-200 dark:border-[#232A3D]/60 flex justify-between">
              <span>Market Cap:</span>
              <span className="text-slate-900 dark:text-slate-200 font-bold">{selectedCompany.marketCap}</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#232A3D] pb-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Risk Trend' },
            { id: 'risks', label: 'Key Tail-Risk Drivers' },
            { id: 'news', label: 'Recent Market News' },
            { id: 'ai', label: 'AI Intelligence Summary' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Trend Chart */}
            <div className="lg:col-span-2 bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-5 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                30-Day Risk Score Trajectory
              </h3>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedCompany.riskTrend}>
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F1420', borderColor: '#232A3D', borderRadius: '12px', color: '#FFF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#8B5CF6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#8B5CF6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sentiment & Risk Gauges */}
            <div className="bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-5 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
              <RiskGauge score={selectedCompany.riskScore} size="md" label="Company Risk Score" />

              <div className="w-full pt-3 border-t border-slate-200 dark:border-[#232A3D] flex justify-between text-xs font-mono text-slate-700 dark:text-slate-300">
                <span>Sentiment:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{selectedCompany.sentimentLabel} ({selectedCompany.sentimentScore}/100)</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Key Risks */}
        {activeTab === 'risks' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Geopolitical & Supply Chain Risk Factors</h3>
            <ul className="space-y-3">
              {selectedCompany.keyRisks.map((risk, idx) => (
                <li key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] text-xs text-slate-800 dark:text-slate-200 flex items-start gap-3">
                  <span className="text-rose-600 dark:text-red-400 font-bold shrink-0">⚠️ Risk {idx + 1}:</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tab 3: News */}
        {activeTab === 'news' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Latest Market News & Intelligence</h3>
            {selectedCompany.recentNews.map((news, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">{news.title}</h4>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{news.source} • {news.time}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                  news.sentiment === 'negative'
                    ? 'bg-rose-100 text-rose-700 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                }`}>
                  {news.sentiment}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: AI Summary */}
        {activeTab === 'ai' && (
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              AI Intelligence Executive Evaluation
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {selectedCompany.aiSummary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
