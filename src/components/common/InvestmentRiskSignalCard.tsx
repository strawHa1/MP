import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Sliders,
  ExternalLink,
  Lock
} from 'lucide-react';
import { CompanyRisk } from '../../types';
import { computeInvestmentRiskSignal, InvestmentSignalLabel } from '../../utils/riskSignal';
import { LiveStockPrice } from './LiveStockPrice';

interface InvestmentRiskSignalCardProps {
  company: CompanyRisk;
  activeEventsCount?: number;
  userRiskTolerance?: number; // 1 - 100
  onNavigate?: (path: string) => void;
  onReviewPosition?: (ticker: string) => void;
  theme?: 'light' | 'dark';
}

export const InvestmentRiskSignalCard: React.FC<InvestmentRiskSignalCardProps> = ({
  company,
  activeEventsCount = 2,
  userRiskTolerance = 55,
  onNavigate,
  onReviewPosition,
  theme = 'light'
}) => {
  const signal = computeInvestmentRiskSignal(company, activeEventsCount, userRiskTolerance);
  const [showModal, setShowModal] = useState(false);

  // Badge styling depending on signal label
  const getLabelBadge = (label: InvestmentSignalLabel) => {
    switch (label) {
      case 'Favorable':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30',
          icon: CheckCircle2,
          colorText: 'text-emerald-600 dark:text-emerald-400'
        };
      case 'Neutral-Hold':
        return {
          bg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/30',
          icon: Info,
          colorText: 'text-sky-600 dark:text-sky-400'
        };
      case 'Caution':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30',
          icon: AlertTriangle,
          colorText: 'text-amber-600 dark:text-amber-400'
        };
      case 'High Risk':
      default:
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/30',
          icon: ShieldAlert,
          colorText: 'text-rose-600 dark:text-rose-400'
        };
    }
  };

  const badgeConfig = getLabelBadge(signal.label);
  const LabelIcon = badgeConfig.icon;

  const handleReviewAction = () => {
    if (onReviewPosition) {
      onReviewPosition(company.ticker);
    } else if (onNavigate) {
      onNavigate(`/portfolio?review=${company.ticker}`);
    } else {
      setShowModal(true);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] shadow-md dark:shadow-xl p-6 space-y-6 font-sans transition-all">
      {/* Top Header Row: Stock Name & Live Price Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#232A3D]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Quantitative Intelligence Signal
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            {company.name} <span className="text-xs text-slate-500 font-mono">(${company.ticker})</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {company.sector} • {company.country} • Risk Tolerance Threshold: <span className="font-mono font-bold">{userRiskTolerance}/100</span>
          </p>
        </div>

        {/* Live Price Block */}
        <div className="bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-3.5 rounded-xl shrink-0 min-w-[240px] flex flex-col justify-center space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
            LIVE MARKET QUOTE
          </span>
          <LiveStockPrice symbol={company.ticker} size="md" showDetails={true} />
        </div>
      </div>

      {/* Main Signal Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Signal Label & Score Box */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              INVESTMENT RISK SIGNAL
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-xl text-sm font-bold border flex items-center gap-1.5 ${badgeConfig.bg}`}>
                <LabelIcon className="w-4 h-4" />
                {signal.label}
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-[#232A3D]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Computed Composite Score:</span>
              <span className={`font-mono font-bold ${badgeConfig.colorText}`}>
                {signal.compositeScore} / 100
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-[#232A3D] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  signal.compositeScore >= 75
                    ? 'bg-rose-500'
                    : signal.compositeScore >= 55
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${signal.compositeScore}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1">
              <span>Confidence: <strong className="text-slate-700 dark:text-slate-200">{signal.confidencePct}%</strong></span>
              <span>Tolerance Limit: {userRiskTolerance}</span>
            </div>
          </div>
        </div>

        {/* Key Drivers Bullets */}
        <div className="md:col-span-2 p-5 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Signal Key Drivers & Algorithmic Rationale
          </h4>
          <ul className="space-y-2">
            {signal.keyDrivers.map((driver, idx) => (
              <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-blue-500 font-bold shrink-0">•</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Distinct Withdrawal / Exposure Warning Panel */}
      {signal.isCapitalLossWarning && (
        <div className="p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-900 dark:text-rose-200 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  Capital Loss Risk Warning
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-200 mt-0.5 leading-relaxed">
                  {signal.warningMessage}
                </p>
              </div>
            </div>

            <button
              onClick={handleReviewAction}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <Sliders className="w-4 h-4" /> Review Position
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Always-Visible Disclaimer */}
      <div className="pt-3 border-t border-slate-200 dark:border-[#232A3D] flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-mono bg-slate-50/50 dark:bg-[#161B2C]/50 p-3 rounded-xl border border-slate-200/60 dark:border-[#232A3D]/60">
        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Mandatory Disclosure:</strong> This Investment Risk Signal is an automated quantitative analytics indicator derived from sentiment, volatility, and macro risk models. It does not constitute personalized financial, investment, or trading advice.
        </span>
      </div>

      {/* Position Review Modal if triggered */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#232A3D]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                Position Exposure Review
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              The automated risk signal for <strong>${company.ticker}</strong> indicates a composite threat score of{' '}
              <span className="font-bold text-rose-500">{signal.compositeScore}/100</span>.
            </p>

            <div className="p-3 bg-slate-100 dark:bg-[#161B2C] rounded-xl text-xs space-y-1 font-mono text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Signal Status:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{signal.label}</span>
              </div>
              <div className="flex justify-between">
                <span>Risk Tolerance Limit:</span>
                <span className="font-bold">{userRiskTolerance}/100</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  if (onNavigate) onNavigate('/portfolio');
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all text-center"
              >
                Go to Portfolio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
