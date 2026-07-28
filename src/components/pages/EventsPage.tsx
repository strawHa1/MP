import React, { useState } from 'react';
import {
  Flame,
  Search,
  Filter,
  ShieldAlert,
  Globe2,
  ChevronRight,
  Clock,
  Building2,
  BarChart3
} from 'lucide-react';
import { GlobalEvent, RiskSeverity } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';

interface EventsPageProps {
  onNavigate: (path: string) => void;
  events: GlobalEvent[];
}

export const EventsPage: React.FC<EventsPageProps> = ({ onNavigate, events }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEvents = events.filter((evt) => {
    const matchesQuery =
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterSeverity === 'all') return matchesQuery;
    if (filterSeverity === 'critical') return matchesQuery && evt.severity === 'critical';
    if (filterSeverity === 'high') return matchesQuery && (evt.severity === 'high' || evt.severity === 'critical');
    if (filterSeverity === 'medium') return matchesQuery && evt.severity === 'medium';
    if (filterSeverity === 'low') return matchesQuery && evt.severity === 'low';

    return matchesQuery;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-red-400 font-bold uppercase tracking-wider">
            <Flame className="w-4 h-4 text-red-500 animate-bounce" />
            24/7 Global Risk Event Monitor
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">Global Events</h1>
          <p className="text-slate-400 text-xs mt-0.5">Live feed of critical geopolitical, climate, supply chain, and macroeconomic shocks</p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-[#0F1420] border border-[#232A3D] px-3 py-1.5 rounded-xl">
          Tracking <span className="text-white font-bold">{filteredEvents.length}</span> active events
        </div>
      </div>

      {/* Filter Pills & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#0F1420] border border-[#232A3D] p-4 rounded-2xl shadow-lg">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'critical', label: 'Critical Only' },
            { id: 'high', label: 'High Risk' },
            { id: 'medium', label: 'Medium Risk' },
            { id: 'low', label: 'Low Risk' }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterSeverity(pill.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterSeverity === pill.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'bg-[#161B2C] text-slate-400 hover:text-slate-200 border border-[#232A3D]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search event keywords..."
            className="w-full bg-[#161B2C] border border-[#232A3D] rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Events List Table / Cards */}
      <div className="space-y-3">
        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            onClick={() => onNavigate(`/events?id=${evt.id}`)}
            className="bg-[#0F1420] border border-[#232A3D] hover:border-slate-500 p-5 rounded-2xl shadow-lg cursor-pointer transition-all hover:scale-[1.005] group"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityBadge severity={evt.severity} size="sm" />
                  {evt.isLive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase">Live News</span>
                  )}
                  <span className="text-xs font-mono font-bold text-slate-400 bg-[#161B2C] border border-[#232A3D] px-2 py-0.5 rounded">
                    {evt.category}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    <Globe2 className="w-3.5 h-3.5 text-blue-400" />
                    {evt.region}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto md:ml-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {evt.reportedAt}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                  {evt.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {evt.description}
                </p>

                {/* Affected Tickertapes */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Affected Tickers:</span>
                  <div className="flex gap-1.5">
                    {evt.affectedCompanyTickers.map((ticker) => (
                      <span key={ticker} className="text-[10px] font-mono font-bold bg-[#161B2C] text-blue-300 border border-[#232A3D] px-2 py-0.5 rounded">
                        ${ticker}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Impact Score */}
              <div className="flex md:flex-col items-center justify-between md:justify-center md:text-right border-t md:border-t-0 md:border-l border-[#232A3D] pt-3 md:pt-0 md:pl-6 shrink-0">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Market Impact</div>
                  <div className="text-2xl font-black font-mono text-red-400 mt-0.5">{evt.impactScore} <span className="text-xs font-normal text-slate-500">/ 100</span></div>
                </div>

                <div className="mt-2 text-xs text-blue-400 font-bold flex items-center gap-1 group-hover:underline">
                  Analyze Details <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredEvents.length === 0 && (
          <div className="bg-[#0F1420] border border-[#232A3D] p-12 rounded-2xl text-center text-slate-400">
            No global events matched your criteria. Try adjusting search filters.
          </div>
        )}
      </div>
    </div>
  );
};
