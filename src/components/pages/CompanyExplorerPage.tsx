import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Loader2,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { CompanyRisk } from '../../types';
import { LiveStockPrice } from '../common/LiveStockPrice';
import {
  MarketSearch,
  getQuickAccessChips,
  addRecentSearch
} from '../common/MarketSearch';
import { useCompanyProfile } from '../../lib/useCompanyProfile';
import { computeInvestmentRiskSignal, InvestmentSignalLabel } from '../../utils/riskSignal';

interface CompanyExplorerPageProps {
  initialSymbol?: string;
  filter?: string;
  filterTickers?: string[];
  onNavigate: (path: string) => void;
  companies: CompanyRisk[];
  userRiskTolerance?: number;
  theme?: 'light' | 'dark';
}

function profitStatus(label: InvestmentSignalLabel): { text: string; detail: string; positive: boolean } {
  switch (label) {
    case 'Favorable':
      return { text: 'Good to Invest', detail: 'Strong profit potential with manageable risk', positive: true };
    case 'Neutral-Hold':
      return { text: 'Hold / Wait', detail: 'Moderate profit potential — monitor before investing', positive: false };
    case 'Caution':
      return { text: 'Invest with Caution', detail: 'Limited profit potential; elevated risk of drawdown', positive: false };
    case 'High Risk':
    default:
      return { text: 'Not Recommended', detail: 'High loss risk outweighs profit potential', positive: false };
  }
}

function signalIcon(label: InvestmentSignalLabel) {
  switch (label) {
    case 'Favorable': return CheckCircle2;
    case 'Neutral-Hold': return Info;
    case 'Caution': return AlertTriangle;
    default: return ShieldAlert;
  }
}

export const CompanyExplorerPage: React.FC<CompanyExplorerPageProps> = ({
  initialSymbol = '',
  filter = '',
  filterTickers = [],
  onNavigate,
  companies,
  userRiskTolerance = 55
}) => {
  const isAtRiskView = filter === 'at-risk';
  const [selectedTicker, setSelectedTicker] = useState(initialSymbol.toUpperCase());
  const [chips, setChips] = useState<{ ticker: string; name?: string }[]>(getQuickAccessChips(10));

  const hasSelection = selectedTicker.length > 0;

  const { profile, loading, notFound, error, refresh } = useCompanyProfile(
    hasSelection ? selectedTicker : '',
    8_000
  );

  const refreshChips = useCallback(() => {
    setChips(getQuickAccessChips(10));
  }, []);

  useEffect(() => {
    setSelectedTicker(initialSymbol ? initialSymbol.toUpperCase() : '');
  }, [initialSymbol]);

  useEffect(() => {
    refreshChips();
    const onRecent = () => refreshChips();
    window.addEventListener('bs-recent-updated', onRecent);
    return () => window.removeEventListener('bs-recent-updated', onRecent);
  }, [refreshChips]);

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

  const signal = useMemo(() => {
    if (!displayCompany) return null;
    return computeInvestmentRiskSignal(
      displayCompany,
      profile?.activeImpactCount ?? 0,
      userRiskTolerance
    );
  }, [displayCompany, profile?.activeImpactCount, userRiskTolerance]);

  const profit = signal ? profitStatus(signal.label) : null;
  const SignalIcon = signal ? signalIcon(signal.label) : Info;

  if (isAtRiskView && !hasSelection) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-6 max-w-4xl mx-auto font-sans space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            Companies at Risk
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">High-Risk Watchlist</h1>
          <p className="text-slate-400 text-xs mt-1">
            Live news-to-price impact signals from the impact pipeline
          </p>
        </div>

        {filterTickers.length === 0 ? (
          <div className="bg-[#0F1420] border border-[#232A3D] p-8 rounded-2xl text-center text-slate-400 text-sm">
            No impacted companies detected right now. Check back after the next news refresh.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filterTickers.map((ticker) => (
              <button
                key={ticker}
                type="button"
                onClick={() => onNavigate(`/companies?symbol=${encodeURIComponent(ticker)}`)}
                className="text-left p-4 rounded-xl bg-[#0F1420] border border-[#232A3D] hover:border-purple-500/50 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">${ticker}</span>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    At Risk
                  </span>
                </div>
                <LiveStockPrice symbol={ticker} size="sm" showDetails={false} />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate('/companies')}
          className="text-xs text-blue-400 hover:underline font-semibold"
        >
          ← Search all companies
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col p-6 max-w-3xl mx-auto font-sans">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
          <Building2 className="w-4 h-4" />
          Company Explorer
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
          Search a stock to see risk & investment status
        </p>
      </div>

      {/* Centered search */}
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="w-full max-w-lg">
          <MarketSearch
            onSelect={handleSelect}
            placeholder="Search company — Apple, AAPL, TSLA..."
            className="w-full"
            wide
          />
        </div>

        {chips.length > 0 && !hasSelection && (
          <div className="flex items-center justify-center gap-2 flex-wrap mt-4 max-w-lg">
            {chips.slice(0, 6).map(({ ticker, name }) => (
              <button
                key={ticker}
                onClick={() => handleSelect(ticker, name)}
                className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-[#0F1420] text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-[#232A3D] hover:border-blue-500 transition-colors"
              >
                ${ticker}
              </button>
            ))}
          </div>
        )}

        {!hasSelection && (
          <p className="text-center text-xs text-slate-500 mt-8">
            Type a company name or ticker above to get started
          </p>
        )}

        {hasSelection && loading && !displayCompany && (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
            <p className="text-xs">Analyzing {selectedTicker}...</p>
          </div>
        )}

        {hasSelection && notFound && (
          <div className="mt-8 w-full max-w-lg bg-[#0F1420] border border-amber-500/30 p-8 rounded-2xl text-center">
            <p className="text-sm font-bold text-white">Company not found</p>
            <p className="text-xs text-slate-400 mt-1">Try another ticker or company name.</p>
          </div>
        )}

        {hasSelection && error && !displayCompany && (
          <div className="mt-8 w-full max-w-lg bg-[#0F1420] border border-red-500/30 p-8 rounded-2xl text-center">
            <p className="text-red-400 text-sm font-bold">Unable to fetch live data</p>
            <button onClick={refresh} className="mt-2 text-xs text-blue-400 hover:underline">Retry</button>
          </div>
        )}

        {hasSelection && displayCompany && signal && profit && (
          <div className="mt-8 w-full max-w-lg space-y-4 animate-in fade-in duration-300">
            {/* Company header */}
            <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] rounded-2xl p-5 text-center">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{displayCompany.name}</h2>
              <p className="text-sm font-mono text-blue-500 dark:text-blue-400 mt-0.5">${displayCompany.ticker}</p>
              <p className="text-xs text-slate-500 mt-1">{displayCompany.sector} • {displayCompany.country}</p>
              <div className="mt-4 flex justify-center">
                <LiveStockPrice symbol={displayCompany.ticker} size="md" showDetails />
              </div>
            </div>

            {/* Risk & Profit cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Risk Status</p>
                <div className="flex items-center gap-2">
                  <SignalIcon className={`w-5 h-5 ${
                    signal.label === 'Favorable' ? 'text-emerald-500' :
                    signal.label === 'Neutral-Hold' ? 'text-sky-500' :
                    signal.label === 'Caution' ? 'text-amber-500' : 'text-red-500'
                  }`} />
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{signal.label}</span>
                </div>
                <p className="text-2xl font-extrabold font-mono mt-2 text-slate-900 dark:text-white">
                  {signal.compositeScore}<span className="text-sm text-slate-500">/100</span>
                </p>
                <div className="w-full h-2 bg-slate-200 dark:bg-[#232A3D] rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      signal.compositeScore >= 75 ? 'bg-red-500' :
                      signal.compositeScore >= 55 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${signal.compositeScore}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Sentiment: {displayCompany.sentimentLabel} ({displayCompany.sentimentScore}/100)
                </p>
              </div>

              <div className={`border rounded-2xl p-5 ${
                profit.positive
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
              }`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Profit / Invest Status</p>
                <div className="flex items-center gap-2">
                  {profit.positive ? (
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={`text-lg font-bold ${
                    profit.positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {profit.text}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                  {profit.detail}
                </p>
                {signal.isCapitalLossWarning && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-3 font-medium">
                    ⚠ Risk exceeds your tolerance ({userRiskTolerance}/100)
                  </p>
                )}
              </div>
            </div>

            {/* Key driver summary */}
            <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Key Factors</p>
              <ul className="space-y-1.5">
                {signal.keyDrivers.slice(0, 3).map((d, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex gap-2">
                    <span className="text-blue-500 shrink-0">•</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
