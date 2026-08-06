import React from 'react';
import {
  Shield,
  Zap,
  Globe2,
  TrendingUp,
  ArrowRight,
  Play,
  Check,
  ChevronRight,
  Building2,
  Activity,
  Cpu
} from 'lucide-react';
import { GlobalEvent } from '../../types';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  events: GlobalEvent[];
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, events }) => {
  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Public Header */}
      <nav className="h-20 border-b border-[#232A3D] px-6 lg:px-12 flex items-center justify-between sticky top-0 bg-[#0A0E17]/90 backdrop-blur z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('/dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
            ∆
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-base font-mono">BLACK SWAN</span>
            <span className="block text-[10px] text-slate-400 tracking-widest font-mono">FINANCIAL RISK INTEL</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/login')}
            className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all flex items-center gap-2"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center overflow-hidden">
        <div className="z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            24/7 AI-POWERED GLOBAL THREAT MONITORING
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-none">
            Predict the <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
              Unpredictable.
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-xl leading-relaxed">
            Black Swan monitors geopolitical conflicts, energy chokepoints, supply chain bottlenecks, and rate shocks in real-time. Score corporate exposure and act on live risk intelligence before markets react.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-base shadow-xl shadow-blue-500/30 hover:scale-105 transition-all flex items-center gap-2"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => onNavigate('/reports')}
              className="px-6 py-3.5 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-200 hover:text-white hover:border-slate-600 font-semibold text-base transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 text-purple-400 fill-purple-400" />
              View AI Reports
            </button>
          </div>

          <div className="mt-12 flex items-center gap-8 pt-8 border-t border-[#232A3D]/60 text-slate-400 text-xs font-mono">
            <div>
              <span className="block text-xl font-bold text-slate-100">2,400+</span>
              Global Entities Monitored
            </div>
            <div>
              <span className="block text-xl font-bold text-slate-100">&lt;15s</span>
              Real-Time Price Updates
            </div>
            <div>
              <span className="block text-xl font-bold text-slate-100">99.4%</span>
              Threat Accuracy Index
            </div>
          </div>
        </div>

        {/* Hero Graphic Visualization */}
        <div className="relative flex justify-center items-center">
          <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="w-full max-w-lg bg-[#0F1420] border border-[#232A3D] rounded-2xl p-6 shadow-2xl relative z-10 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-[#232A3D]">
              <div className="flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-mono font-bold uppercase text-slate-300">Global Threat Heatmap Grid</span>
              </div>
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
                CRITICAL ALERT
              </span>
            </div>

            {/* Radar / Grid Visual */}
            <div className="py-8 relative flex items-center justify-center">
              <div className="w-64 h-64 rounded-full border border-blue-500/20 flex items-center justify-center relative animate-spin-slow">
                <div className="w-48 h-48 rounded-full border border-purple-500/30 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border border-pink-500/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Shield className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Glowing Event Markers */}
              <div className="absolute top-12 left-16 bg-red-500/90 text-white text-[10px] font-mono px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Taiwan Strait (92/100)
              </div>
              <div className="absolute bottom-14 right-12 bg-amber-500/90 text-white text-[10px] font-mono px-2 py-1 rounded-lg shadow-lg">
                Strait of Hormuz (84/100)
              </div>
            </div>

            <div className="pt-4 border-t border-[#232A3D] flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Status: ACTIVE INTELLIGENCE</span>
              <span className="text-emerald-400">System Nominal</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Global Risk Feed Ticker Strip */}
      <section className="bg-[#0F1420] border-y border-[#232A3D] py-4 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" /> Live Global Event Stream
          </span>
          <button onClick={() => onNavigate('/events')} className="text-xs text-blue-400 hover:underline font-semibold">
            View All Events →
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto custom-scrollbar px-6 py-2">
          {events.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onNavigate(`/events?id=${evt.id}`)}
              className="bg-[#161B2C] border border-[#232A3D] hover:border-slate-600 p-3 rounded-xl shrink-0 w-80 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded uppercase">
                  {evt.severity} • {evt.impactScore}/100
                </span>
                <span className="text-[10px] text-slate-400">{evt.reportedAt}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{evt.title}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{evt.region} • {evt.category}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Overview Grid */}
      <section id="features" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-white">Institutional Financial Threat Terminal</h2>
          <p className="text-slate-400 mt-3 text-sm">
            Powered by high-frequency market data feeds, geopolitical event intelligence, and generative AI reasoning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl hover:border-blue-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Live Stock Market Data</h3>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Real-time quotes with sub-30s polling, absolute & % changes, market status indicators, and zero historical caching lag.
            </p>
          </div>

          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">AI Intelligence Reports</h3>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Generate executive risk briefs from live geopolitical and market data with structured severity tags and mitigation guidance.
            </p>
          </div>

          <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl hover:border-pink-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Portfolio Tail-Risk Hedging</h3>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Import portfolio holdings to calculate total risk scores, sector concentration limits, and AI recommended hedging actions.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto w-full border-t border-[#232A3D]">
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-white">Flexible Intelligence Plans</h2>
          <p className="text-slate-400 text-sm mt-2">Scale risk monitoring across analysts, traders, and risk committees.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8">
          {/* Pro Plan */}
          <div className="bg-[#0F1420] border border-[#232A3D] p-8 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest font-mono">Standard Terminal</span>
              <div className="text-3xl font-black text-white mt-2">$299 <span className="text-sm font-normal text-slate-400">/ mo</span></div>
              <p className="text-slate-400 text-xs mt-2">Ideal for individual hedge fund analysts, risk managers, and family offices.</p>
              
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Real-time US equity market quote feeds</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 50 AI intelligence reports / mo</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Global Threat Heatmap & Sector Explorer</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> PDF Intelligence Report Export</li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('/dashboard')}
              className="mt-8 w-full py-3 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-slate-500 font-bold text-white transition-all"
            >
              Start Free Trial
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-gradient-to-b from-[#161B2C] to-[#0F1420] border-2 border-purple-500/50 p-8 rounded-2xl flex flex-col justify-between relative shadow-2xl">
            <span className="absolute -top-3 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              MOST POPULAR
            </span>

            <div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-widest font-mono">Enterprise Terminal</span>
              <div className="text-3xl font-black text-white mt-2">$999 <span className="text-sm font-normal text-slate-400">/ mo</span></div>
              <p className="text-slate-400 text-xs mt-2">For multi-asset institutions, central banks, and corporate risk desks.</p>

              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> Unlimited AI Intelligence Reports</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> Dedicated Black Swan AI Chat Assistant</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> Custom Portfolio API & SWIFT Integration</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-400" /> 24/7 Priority Intelligence Hotline</li>
              </ul>
            </div>

            <button
              onClick={() => onNavigate('/dashboard')}
              className="mt-8 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold transition-all shadow-lg shadow-purple-500/25 hover:from-blue-500 hover:to-purple-500"
            >
              Launch Enterprise Terminal
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#232A3D] py-8 px-6 lg:px-12 text-center text-xs text-slate-500">
        <p>© 2026 Black Swan Intelligence Inc. All real-time market data sourced via server-side feeds. Professional financial risk terminal.</p>
      </footer>
    </div>
  );
};
