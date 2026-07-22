import React, { useState } from 'react';
import {
  Settings,
  Bell,
  Sliders,
  Database,
  Shield,
  Key,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Sun,
  Moon,
  AlertTriangle,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface SettingsPageProps {
  onNavigate: (path: string) => void;
  userRiskTolerance: number;
  onUpdateRiskTolerance: (tolerance: number) => void;
  theme: 'light' | 'dark';
  onUpdateTheme: (theme: 'light' | 'dark') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onNavigate,
  userRiskTolerance,
  onUpdateRiskTolerance,
  theme,
  onUpdateTheme
}) => {
  const [activeTab, setActiveTab] = useState<'risk' | 'general' | 'notifications' | 'data' | 'apikeys'>('risk');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [timezone, setTimezone] = useState('UTC-5 (EST)');
  const [pollingFrequency, setPollingFrequency] = useState('15 seconds');

  const getToleranceLabel = (val: number) => {
    if (val <= 40) return { label: 'Conservative', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20' };
    if (val <= 65) return { label: 'Moderate / Balanced', color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20' };
    return { label: 'Aggressive / High-Yield', color: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20' };
  };

  const toleranceInfo = getToleranceLabel(userRiskTolerance);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto font-sans">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Platform & Risk Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
          Customize your institutional risk tolerance threshold, signal sensitivity, light/dark themes, and market data feeds
        </p>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#232A3D] pb-1 overflow-x-auto">
        {[
          { id: 'risk', label: 'Risk Tolerance & Signals', icon: Sliders },
          { id: 'general', label: 'Display & Color Theme', icon: Settings },
          { id: 'notifications', label: 'Alert Thresholds', icon: Bell },
          { id: 'data', label: 'Data Sources & Polling', icon: Database },
          { id: 'apikeys', label: 'API Keys & Secrets', icon: Key }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] p-6 rounded-2xl shadow-sm dark:shadow-xl space-y-6">
        {/* Tab: Risk Tolerance Slider */}
        {activeTab === 'risk' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Institutional Risk Tolerance Calibration
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${toleranceInfo.color}`}>
                  {toleranceInfo.label} ({userRiskTolerance}/100)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adjusting your risk tolerance directly shifts the thresholds for <strong>Caution</strong>, <strong>High Risk</strong>, and <strong>Capital Loss Warning</strong> signals across all company searches, portfolio holdings, and alerts.
              </p>
            </div>

            {/* Range Slider Control */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] space-y-4">
              <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                <span>1 (Max Protection / Conservative)</span>
                <span className="text-blue-600 dark:text-blue-400 text-sm font-extrabold">{userRiskTolerance} / 100</span>
                <span>100 (Max Yield / Aggressive)</span>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                value={userRiskTolerance}
                onChange={(e) => onUpdateRiskTolerance(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 dark:bg-[#232A3D] rounded-lg appearance-none cursor-pointer accent-blue-600"
              />

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onUpdateRiskTolerance(30)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    userRiskTolerance <= 40
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : 'bg-white dark:bg-[#0F1420] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#232A3D] hover:border-emerald-500'
                  }`}
                >
                  Conservative (30)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateRiskTolerance(55)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    userRiskTolerance > 40 && userRiskTolerance <= 65
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                      : 'bg-white dark:bg-[#0F1420] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#232A3D] hover:border-amber-500'
                  }`}
                >
                  Moderate (55)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateRiskTolerance(80)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    userRiskTolerance > 65
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                      : 'bg-white dark:bg-[#0F1420] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#232A3D] hover:border-rose-500'
                  }`}
                >
                  Aggressive (80)
                </button>
              </div>
            </div>

            {/* Impact Explanation */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-1 font-mono">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Dynamic Signal Adaptation Active:
              </div>
              <p className="text-[11px] leading-relaxed">
                {userRiskTolerance <= 40 && "At Conservative tolerance (30), stocks with composite scores above 40/100 trigger Capital Loss Warnings and 'Caution' signals early to protect capital."}
                {userRiskTolerance > 40 && userRiskTolerance <= 65 && "At Moderate tolerance (55), standard balanced thresholds are enforced. Capital Loss Warnings trigger on stocks scoring >55/100."}
                {userRiskTolerance > 65 && "At Aggressive tolerance (80), higher score threshold is permitted before flagging capital drawdown warnings."}
              </p>
            </div>
          </div>
        )}

        {/* Tab: General & Theme */}
        {activeTab === 'general' && (
          <div className="space-y-6 max-w-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Appearance & Theme Configuration</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Color Mode Theme</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => onUpdateTheme('light')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 text-xs font-bold transition-all ${
                    theme === 'light'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-500/30'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  <Sun className="w-6 h-6 text-amber-500" />
                  <span>Executive Light Theme</span>
                  <span className="text-[10px] font-normal text-slate-500">High-contrast executive layout</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateTheme('dark')}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 text-xs font-bold transition-all ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-[#161B2C] text-blue-400 shadow-md ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-[#232A3D] bg-slate-50 dark:bg-[#0F1420] text-slate-600 dark:text-slate-400 hover:border-slate-400'
                  }`}
                >
                  <Moon className="w-6 h-6 text-purple-400" />
                  <span>Dark Terminal</span>
                  <span className="text-[10px] font-normal text-slate-400">Night trading terminal aesthetic</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Timezone Display</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-white dark:bg-[#161B2C] border border-slate-300 dark:border-[#232A3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 shadow-sm"
              >
                <option value="UTC-5 (EST)">UTC-5 (New York / EST)</option>
                <option value="UTC+0 (GMT)">UTC+0 (London / GMT)</option>
                <option value="UTC+8 (SGT)">UTC+8 (Singapore / SGT)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#232A3D]">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-200">Enable Smooth UI Animations</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Hardware rendering acceleration</div>
              </div>
              <input
                type="checkbox"
                checked={animationsEnabled}
                onChange={(e) => setAnimationsEnabled(e.target.checked)}
                className="rounded bg-slate-100 dark:bg-[#161B2C] border-slate-300 dark:border-[#232A3D] text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Tab: Data Streams */}
        {activeTab === 'data' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Market Data Stream Configuration</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Stock Quote Polling Interval</label>
              <select
                value={pollingFrequency}
                onChange={(e) => setPollingFrequency(e.target.value)}
                className="w-full bg-white dark:bg-[#161B2C] border border-slate-300 dark:border-[#232A3D] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 shadow-sm"
              >
                <option value="15 seconds">15 Seconds (Real-time High Frequency)</option>
                <option value="30 seconds">30 Seconds (Standard Feed)</option>
                <option value="60 seconds">60 Seconds (Low Bandwidth)</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Live Exchange Proxy Connected
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Server-side quotes proxy active. Real-time prices updated continuously across all company search views and portfolio holdings.
              </p>
            </div>
          </div>
        )}

        {/* Tab: API Credentials */}
        {activeTab === 'apikeys' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">External API Credentials</h3>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-200">Google Gemini AI Engine:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">ACTIVE (SERVER-SIDE)</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Injected via GEMINI_API_KEY environment variable. Drives risk scenario simulations & executive intelligence summaries.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
