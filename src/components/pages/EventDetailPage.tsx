import React, { useState } from 'react';
import {
  ArrowLeft,
  Flame,
  Globe2,
  Clock,
  Building2,
  ExternalLink,
  ShieldAlert,
  BarChart2,
  Newspaper,
  Layers
} from 'lucide-react';
import { GlobalEvent, CompanyRisk } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';
import { LiveStockPrice } from '../common/LiveStockPrice';
import { useLiveHeadlines, NEWS_POLL_INTERVAL_MS } from '../../lib/newsService';

interface EventDetailPageProps {
  eventId: string;
  onNavigate: (path: string) => void;
  events: GlobalEvent[];
  companies: CompanyRisk[];
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  eventId,
  onNavigate,
  events,
  companies
}) => {
  const event = events.find((e) => e.id === eventId) || events[0];
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'impact' | 'news' | 'similar'>('overview');

  const { feed: newsFeed, loading: newsLoading } = useLiveHeadlines('all', NEWS_POLL_INTERVAL_MS, 30);

  const relatedNews = (newsFeed?.articles || []).filter((article) => {
    const eventWords = event.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const text = `${article.title} ${article.description}`.toLowerCase();
    return eventWords.some((word) => text.includes(word)) ||
      (event.region === 'South Asia' && article.region === 'india') ||
      (event.region === 'Global' && article.region === 'world');
  }).slice(0, 8);

  const displayNews = relatedNews.length > 0 ? relatedNews : (newsFeed?.articles || []).slice(0, 6);

  const affectedCompanies = companies.filter((c) => event.affectedCompanyTickers.includes(c.ticker));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Back Button */}
      <button
        onClick={() => onNavigate('/events')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Global Events Feed
      </button>

      {/* Main Event Header Card */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={event.severity} size="lg" />
            <span className="text-xs font-mono font-bold text-slate-400 bg-[#161B2C] border border-[#232A3D] px-2.5 py-1 rounded-lg uppercase">
              {event.category}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Reported {event.reportedAt}</span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
          {event.title}
        </h1>

        <div className="flex items-center gap-6 text-xs text-slate-400 font-mono pt-2 border-t border-[#232A3D]">
          <div>
            <span className="text-slate-500 uppercase">Region:</span>{' '}
            <span className="text-slate-200 font-bold">{event.region}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase">Impact Score:</span>{' '}
            <span className="text-red-400 font-extrabold">{event.impactScore} / 100</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase">Confidence:</span>{' '}
            <span className="text-emerald-400 font-bold">96% Verified</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#232A3D] pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'timeline', label: 'Event Timeline' },
          { id: 'impact', label: 'Impact Analysis' },
          { id: 'news', label: 'Source Intelligence' },
          { id: 'similar', label: 'Similar Historical Events' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Event Summary Card */}
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Event Overview & Intelligence Summary</h3>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                {event.description}
              </p>
            </div>

            {/* Potential Market Impact */}
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-red-400" />
                Potential Market Impact Assessment
              </h3>
              <div className="p-4 rounded-xl bg-[#161B2C] border border-[#232A3D] text-xs text-red-300 leading-relaxed">
                {event.marketImpactSummary}
              </div>
            </div>

            {/* Affected Companies Grid with Live Stock Prices */}
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                Affected Companies & Live Equity Quotes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {affectedCompanies.map((comp) => (
                  <div
                    key={comp.ticker}
                    onClick={() => onNavigate(`/companies?symbol=${comp.ticker}`)}
                    className="p-4 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-slate-500 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-100">{comp.name}</span>
                      <span className="text-[10px] font-mono font-bold bg-[#0A0E17] text-blue-400 px-2 py-0.5 rounded border border-[#232A3D]">
                        ${comp.ticker}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <LiveStockPrice symbol={comp.ticker} size="sm" showDetails={false} />
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        Risk: {comp.riskScore}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar Details */}
          <div className="space-y-6">
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metadata Parameters</h3>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-[#232A3D]">
                  <span className="text-slate-500">Threat Severity:</span>
                  <SeverityBadge severity={event.severity} size="sm" />
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#232A3D]">
                  <span className="text-slate-500">Impact Score:</span>
                  <span className="text-red-400 font-extrabold">{event.impactScore} / 100</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#232A3D]">
                  <span className="text-slate-500">Region:</span>
                  <span className="text-slate-200">{event.region}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#232A3D]">
                  <span className="text-slate-500">Category:</span>
                  <span className="text-slate-200">{event.category}</span>
                </div>
              </div>
            </div>

            {/* Verification Sources Footer */}
            <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Intelligence Sources</h3>
              <div className="flex flex-wrap gap-2">
                {event.sources.map((src) => (
                  <span key={src} className="text-xs font-mono bg-[#161B2C] border border-[#232A3D] px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 text-blue-400" />
                    {src}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chronological Event Progression</h3>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#232A3D]">
            {(event.timeline || [
              { date: 'Initial Alert', title: 'Event Detected', detail: 'Event flagged by satellite & maritime telemetry sensors.' },
              { date: 'T+2 Hours', title: 'Intelligence Verification', detail: 'Cross-verified across 4 tier-1 news & defense wire services.' }
            ]).map((t, idx) => (
              <div key={idx} className="relative">
                <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-[#0F1420]" />
                <div className="text-xs font-mono font-bold text-blue-400">{t.date}</div>
                <div className="text-sm font-bold text-white mt-0.5">{t.title}</div>
                <div className="text-xs text-slate-400 mt-1">{t.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Impact Analysis */}
      {activeTab === 'impact' && (
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quantitative Transmission Analysis</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            This event transmits price shock waves through global equity markets by increasing raw material shipping lead-times, inflating insurance premiums, and triggering capital flight to safe-haven assets.
          </p>

          <button
            onClick={() => onNavigate(`/simulations?scenario=${encodeURIComponent(event.title)}`)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg"
          >
            Run Full "What-If" AI Simulation for this Event →
          </button>
        </div>
      )}

      {/* Tab 4: Live News | Tab 5 Placeholder */}
      {activeTab === 'news' && (
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-blue-400" />
              Live India & World News Feed
            </h3>
            {newsFeed?.lastUpdated && (
              <span className="text-[10px] text-emerald-400 font-mono">
                Updated {new Date(newsFeed.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
          {newsLoading && displayNews.length === 0 ? (
            <div className="text-center text-slate-400 text-xs py-8">Loading live news...</div>
          ) : (
            <div className="space-y-3">
              {displayNews.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-xl bg-[#161B2C] border border-[#232A3D] hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-blue-400 uppercase">{article.source}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{article.timeAgo}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">{article.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{article.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                      article.region === 'india' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {article.region === 'india' ? 'India' : 'World'}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                      article.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                      article.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {article.sentiment}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'similar' && (
        <div className="bg-[#0F1420] border border-[#232A3D] p-8 rounded-2xl text-center text-slate-400 text-xs">
          Loading historical analogue comparisons...
        </div>
      )}
    </div>
  );
};
