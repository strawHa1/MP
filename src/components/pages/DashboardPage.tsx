import React from 'react';
import {
  Activity,
  ShieldAlert,
  Building2,
  Bell,
  TrendingDown,
  Globe2,
  ArrowRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Compass
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { GlobalEvent, CompanyRisk, RiskSeverity } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';
import { RiskGauge } from '../common/RiskGauge';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  events: GlobalEvent[];
  companies: CompanyRisk[];
}

const TREND_30_DAYS = [
  { day: 'Jul 1', score: 58 },
  { day: 'Jul 5', score: 61 },
  { day: 'Jul 8', score: 64 },
  { day: 'Jul 12', score: 60 },
  { day: 'Jul 15', score: 68 },
  { day: 'Jul 18', score: 70 },
  { day: 'Jul 22', score: 72 }
];

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, events, companies }) => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Welcome / Header Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            LIVE RISK INTELLIGENCE RADAR
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Global Risk Intelligence Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/simulations')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-yellow-300" />
            Run AI Simulation
          </button>
        </div>
      </div>

      {/* Top Row: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat Card 1: Global Risk Score */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Global Risk Score
            </span>
            <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Activity className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">72</span>
            <span className="text-xs text-slate-400">/ 100</span>
            <SeverityBadge severity="high" size="sm" className="ml-auto" />
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400 font-semibold">
            <TrendingDown className="w-3.5 h-3.5 rotate-180" />
            <span>+4 pts from last week (Elevated)</span>
          </div>
        </div>

        {/* Stat Card 2: Active Black Swan Events */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Black Swans
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">12</span>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full ml-auto">
              +3 Today
            </span>
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Critical Focus: Taiwan & Hormuz</span>
            <button onClick={() => onNavigate('/events')} className="text-blue-400 font-semibold hover:underline">
              View Feed
            </button>
          </div>
        </div>

        {/* Stat Card 3: Companies at Risk */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Companies At Risk
            </span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Building2 className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">248</span>
            <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full ml-auto">
              +18 Today
            </span>
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>High Risk: TSM, NVDA, ASML</span>
            <button onClick={() => onNavigate('/companies')} className="text-blue-400 font-semibold hover:underline">
              Explore
            </button>
          </div>
        </div>

        {/* Stat Card 4: Critical Alerts */}
        <div className="bg-[#0F1420] border border-red-500/30 p-5 rounded-2xl shadow-lg relative overflow-hidden hover:border-red-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Critical Alerts
            </span>
            <span className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Bell className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-white">5</span>
            <button
              onClick={() => onNavigate('/alerts')}
              className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-300 font-medium truncate">
            Taiwan Strait Live Exclusion Zone Active
          </div>
        </div>
      </div>

      {/* Middle Row: Charts & Dial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend (30 Days) Chart */}
        <div className="lg:col-span-2 bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Global Risk Score Trend (30 Days)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Composite Index measuring geopolitical, maritime chokepoint, and commodity stress.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-300 bg-[#161B2C] border border-[#232A3D] px-2.5 py-1 rounded-lg">
              30D HIGH: 74
            </span>
          </div>

          <div className="h-56 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TREND_30_DAYS}>
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis domain={[40, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161B2C', borderColor: '#232A3D', borderRadius: '12px', color: '#FFF' }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#EF4444' }}
                  activeDot={{ r: 6, fill: '#FFF' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Sentiment Dial Card */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl flex flex-col items-center justify-between text-center">
          <div className="w-full text-left">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              Global Market Sentiment
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Real-time NLP analysis of news & financial streams</p>
          </div>

          <div className="my-4">
            <RiskGauge score={31} size="lg" label="BEARISH SENTIMENT" />
          </div>

          <div className="w-full bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl text-xs text-slate-300 flex items-center justify-between font-mono">
            <span>BEARISH: 69%</span>
            <span>NEUTRAL: 21%</span>
            <span>BULLISH: 10%</span>
          </div>
        </div>
      </div>

      {/* World Map Heatmap Preview Row */}
      <div 
        onClick={() => onNavigate('/map')}
        className="bg-[#0F1420] border border-[#232A3D] hover:border-blue-500/50 p-6 rounded-2xl shadow-xl cursor-pointer transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 group-hover:text-blue-400 transition-colors">
              <Globe2 className="w-5 h-5 text-blue-400" />
              Global Risk Heatmap Preview
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Geographic threat distribution across 190+ countries</p>
          </div>
          <span className="text-xs text-blue-400 font-bold flex items-center gap-1 group-hover:underline">
            Open Interactive Map <ArrowRight className="w-4 h-4" />
          </span>
        </div>

        {/* Mini World Preview Graphic */}
        <div className="h-40 bg-[#161B2C] rounded-xl border border-[#232A3D] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="z-10 text-center space-y-2">
            <div className="flex justify-center gap-4 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">Taiwan: 88 Critical</span>
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Hormuz: 81 High</span>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">US: 32 Low</span>
            </div>
            <p className="text-xs text-slate-400">Click to enter the full GIS Geographic Threat Studio</p>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Events, AI Insights, Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Events List */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Events Feed</h3>
            <button onClick={() => onNavigate('/events')} className="text-xs text-blue-400 hover:underline font-semibold">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {events.slice(0, 3).map((evt) => (
              <div
                key={evt.id}
                onClick={() => onNavigate(`/events?id=${evt.id}`)}
                className="p-3 rounded-xl bg-[#161B2C] hover:bg-slate-800/80 border border-[#232A3D] cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <SeverityBadge severity={evt.severity} size="sm" />
                  <span className="text-[10px] text-slate-400 font-mono">{evt.reportedAt}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mt-2 line-clamp-1">{evt.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{evt.region} • Impact Score: {evt.impactScore}/100</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights Card */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              AI Risk Insights
            </h3>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">AUTOGEN</span>
          </div>

          <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <li className="flex gap-2.5 p-2.5 rounded-xl bg-[#161B2C] border border-[#232A3D]">
              <span className="text-purple-400 font-bold">•</span>
              <span><strong>Semiconductor Concentrated Bottleneck:</strong> Taiwan Strait live exercise zones place 22% of portfolio market value at risk within 30 days.</span>
            </li>
            <li className="flex gap-2.5 p-2.5 rounded-xl bg-[#161B2C] border border-[#232A3D]">
              <span className="text-purple-400 font-bold">•</span>
              <span><strong>Energy Transit Surcharge:</strong> War risk hull insurance spikes in Hormuz will drive Brent crude baseline above $88/bbl near-term.</span>
            </li>
          </ul>
        </div>

        {/* Recommended Actions Card */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Recommended Actions
            </h3>
            <button onClick={() => onNavigate('/portfolio')} className="text-xs text-blue-400 hover:underline font-semibold">
              Portfolio
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-[#161B2C] border border-[#232A3D] flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Hedge TSM Exposure</div>
                <div className="text-[11px] text-slate-400">Buy out-of-the-money 60-day put options</div>
              </div>
              <button 
                onClick={() => onNavigate('/portfolio')}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold"
              >
                Execute
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#161B2C] border border-[#232A3D] flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Rebalance into Defense</div>
                <div className="text-[11px] text-slate-400">Increase LMT allocation to 18%</div>
              </div>
              <button 
                onClick={() => onNavigate('/portfolio')}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
