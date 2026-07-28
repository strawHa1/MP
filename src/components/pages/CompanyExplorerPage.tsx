import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Activity,
  Zap,
  Pin,
  PinOff,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { CompanyRisk } from '../../types';
import { LiveStockPrice } from '../common/LiveStockPrice';
import { RiskGauge } from '../common/RiskGauge';
import { SeverityBadge } from '../common/SeverityBadge';
import { InvestmentRiskSignalCard } from '../common/InvestmentRiskSignalCard';
import {
  MarketSearch,
  getQuickAccessChips,
  addRecentSearch,
  getPinnedTickers,
  togglePin
} from '../common/MarketSearch';
import { useCompanyNews, NEWS_POLL_INTERVAL_MS } from '../../lib/newsService';
import { useCompanyProfile } from '../../lib/useCompanyProfile';
import { isPinned } from '../../lib/watchlistService';

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
  const [selectedTicker, setSelectedTicker] = useState(initialSymbol.toUpperCase());
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'news' | 'ai'>('overview');
  const [pinned, setPinned] = useState<string[]>(getPinnedTickers());
  const [chips, setChips] = useState<{ ticker: string; name?: string }[]>(getQuickAccessChips(10));
  const [chipMeta, setChipMeta] = useState<Record<string, number>>({});

  const { profile, loading, notFound, error, refreshing, secondsAgo, refresh } = useCompanyProfile(
    selectedTicker,
    8_000
  );

  const { recentNews: liveNews, loading: newsLoading, lastUpdated: newsUpdated } = useCompanyNews(
    selectedTicker,
    NEWS_POLL_INTERVAL_MS
  );

  const refreshChips = useCallback(() => {
    setChips(getQuickAccessChips(10));
    setPinned(getPinnedTickers());
  }, []);

  useEffect(() => {
    setSelectedTicker(initialSymbol.toUpperCase());
  }, [initialSymbol]);

  useEffect(() => {
    refreshChips();
    const onRecent = () => refreshChips();
    window.addEventListener('bs-recent-updated', onRecent);
    return () => window.removeEventListener('bs-recent-updated', onRecent);
  }, [refreshChips]);

  useEffect(() => {
    if (profile) {
      setChipMeta((prev) => ({ ...prev, [profile.ticker]: profile.riskScore }));
    }
  }, [profile]);

  useEffect(() => {
    for (const c of chips) {
      const mock = companies.find((co) => co.ticker === c.ticker);
      if (mock && chipMeta[c.ticker] == null) {
        setChipMeta((prev) => ({ ...prev, [c.ticker]: mock.riskScore }));
      }
    }
  }, [chips, companies, chipMeta]);

  const handleSelect = useCallback((ticker: string, name?: string) => {
    addRecentSearch(ticker, name);
    setSelectedTicker(ticker.toUpperCase());
    refreshChips();
  }, [refreshChips]);

  const fallbackCompany = companies.find((c) => c.ticker === selectedTicker);
  const displayCompany: CompanyRisk | null = profile
    ? {
        ticker: profile.ticker,
        name: profile.name,
        sector: profile.sector,
        country: profile.country,
        marketCap: profile.marketCap,
        riskScore: profile.riskScore,
        sentimentScore: profile.sentimentScore,
        sentimentLabel: profile.sentimentLabel as CompanyRisk['sentimentLabel'],
        description: profile.description,
        keyRisks: profile.keyRisks,
        aiSummary: profile.aiSummary,
        recentNews: fallbackCompany?.recentNews || [],
        riskTrend: profile.riskTrend
      }
    : fallbackCompany || null;

  const displayNews = liveNews.length > 0 ? liveNews : displayCompany?.recentNews || [];

  const handlePinToggle = useCallback(() => {
    togglePin(selectedTicker);
    refreshChips();
  }, [selectedTicker, refreshChips]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
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
            Search any publicly listed company — live quotes via Finnhub
          </p>
        </div>
        <MarketSearch onSelect={handleSelect} className="w-full sm:w-96" wide />
      </div>

      {/* Pinned + recent quick-access chips (max 10) */}
      {chips.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {chips.map(({ ticker, name }) => (
            <button
              key={ticker}
              onClick={() => handleSelect(ticker, name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shrink-0 border ${
                selectedTicker === ticker
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-md'
                  : 'bg-white dark:bg-[#0F1420] text-slate-700 dark:text-slate-400 border-slate-200 dark:border-[#232A3D] hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>${ticker}</span>
              {name && selectedTicker !== ticker && (
                <span className="text-[10px] font-sans text-slate-500 dark:text-slate-500 truncate max-w-[80px] hidden sm:inline">
                  {name.split(' ')[0]}
                </span>
              )}
              {chipMeta[ticker] != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans ${
                  chipMeta[ticker] >= 75 ? 'bg-rose-100 text-rose-700 dark:bg-red-500/20 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                }`}>
                  {chipMeta[ticker]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && !profile && !displayCompany ? (
        <div className="flex flex-col items-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
          <p className="text-xs">Loading live profile for {selectedTicker}...</p>
        </div>
      ) : notFound ? (
        <div className="bg-[#0F1420] border border-amber-500/30 p-10 rounded-2xl text-center space-y-3">
          <p className="text-lg font-bold text-white">Company not found</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No matching company found for <strong>{selectedTicker}</strong>. Try another company name or ticker in the search bar above.
          </p>
        </div>
      ) : error && !displayCompany ? (
        <div className="bg-[#0F1420] border border-red-500/30 p-8 rounded-2xl text-center">
          <p className="text-red-400 text-sm font-bold">Unable to fetch live market data. Please try again.</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button onClick={refresh} className="mt-3 text-xs text-blue-400 hover:underline">Retry</button>
        </div>
      ) : displayCompany ? (
        <>
          <InvestmentRiskSignalCard
            company={displayCompany}
            activeEventsCount={profile?.activeImpactCount ?? 0}
            userRiskTolerance={userRiskTolerance}
            onNavigate={onNavigate}
            theme={theme}
          />

          <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-6 rounded-2xl shadow-sm dark:shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-[#232A3D]">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-[#161B2C] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#232A3D] px-2.5 py-1 rounded-lg">
                    {profile?.exchange || 'NYSE'}: {displayCompany.ticker}
                  </span>
                  <SeverityBadge
                    severity={displayCompany.riskScore >= 75 ? 'critical' : displayCompany.riskScore >= 55 ? 'high' : 'medium'}
                    size="md"
                  />
                  <button
                    onClick={handlePinToggle}
                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-amber-400"
                  >
                    {isPinned(selectedTicker) ? <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> : <PinOff className="w-3.5 h-3.5" />}
                    {isPinned(selectedTicker) ? 'Pinned' : 'Pin'}
                  </button>
                  {profile?.inWatchlist && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase">Risk Watchlist</span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{displayCompany.name}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">{displayCompany.description}</p>
              </div>

              <div className="bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-4 rounded-xl shrink-0 min-w-[260px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Live Market Quote</span>
                  {secondsAgo != null && (
                    <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                      {refreshing && <RefreshCw className="w-3 h-3 animate-spin" />}
                      Updated {secondsAgo}s ago
                    </span>
                  )}
                </div>
                <LiveStockPrice symbol={displayCompany.ticker} size="lg" showDetails />
                <div className="text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200 dark:border-[#232A3D]/60 flex justify-between mt-2">
                  <span>Market Cap:</span>
                  <span className="text-slate-900 dark:text-slate-200 font-bold">{displayCompany.marketCap}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#232A3D] pb-1 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview & Risk Trend' },
                { id: 'risks', label: 'Key Tail-Risk Drivers' },
                { id: 'news', label: 'Recent Market News' },
                { id: 'ai', label: 'AI Intelligence Summary' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${
                    activeTab === tab.id ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-5 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" /> 30-Day Risk Score Trajectory
                  </h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayCompany.riskTrend}>
                        <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F1420', borderColor: '#232A3D', borderRadius: '12px' }} />
                        <Line type="monotone" dataKey="score" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, fill: '#8B5CF6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-5 rounded-xl flex flex-col items-center">
                  <RiskGauge score={displayCompany.riskScore} size="md" label="Company Risk Score" />
                  <div className="w-full pt-3 border-t border-slate-200 dark:border-[#232A3D] text-xs font-mono text-center mt-4">
                    Sentiment: <span className="font-bold text-amber-500">{displayCompany.sentimentLabel}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'risks' && (
              <ul className="space-y-3">
                {displayCompany.keyRisks.map((risk, idx) => (
                  <li key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] text-xs text-slate-800 dark:text-slate-200">
                    <span className="text-rose-600 font-bold">⚠️ Risk {idx + 1}: </span>{risk}
                  </li>
                ))}
              </ul>
            )}

            {activeTab === 'news' && (
              <div className="space-y-3">
                {newsLoading && liveNews.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">Fetching live news...</div>
                ) : displayNews.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No recent news available for {displayCompany.ticker}.</div>
                ) : (
                  displayNews.map((news, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] flex justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">{news.title}</h4>
                        <div className="text-[10px] text-slate-500 mt-1">{news.source} • {news.time}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100 dark:bg-slate-500/20">{news.sentiment}</span>
                    </div>
                  ))
                )}
                {newsUpdated && <p className="text-[10px] text-emerald-500 font-mono">News updated {new Date(newsUpdated).toLocaleTimeString()}</p>}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D]">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-purple-400" /> AI Evaluation</h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{displayCompany.aiSummary}</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
