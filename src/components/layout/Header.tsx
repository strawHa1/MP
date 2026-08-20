import React, { useState } from 'react';
import {
  Bell,
  ShieldAlert,
  Bot
} from 'lucide-react';
import { AlertItem } from '../../types';
import { MarketSearch } from '../common/MarketSearch';

interface HeaderProps {
  onNavigate: (path: string) => void;
  alerts?: AlertItem[];
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  alerts = [],
  unreadCount = 0
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white/90 dark:bg-[#0F1420]/90 backdrop-blur border-b border-slate-200 dark:border-[#232A3D] px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors">
      {/* Search Input Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <MarketSearch
          onSelect={(ticker) => onNavigate(`/companies?symbol=${ticker}`)}
          placeholder="Search any company — Apple, AAPL, TSLA..."
          className="w-full"
          inputClassName="w-full bg-slate-100 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] rounded-xl px-3 py-2 pl-9 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Right Action Icons & Tickers */}
      <div className="flex items-center gap-3">
        {/* Live Market Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">LIVE FEED</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-700 dark:text-slate-300">US EQUITY: OPEN</span>
        </div>

        {/* AI Assistant Quick Button */}
        <button
          onClick={() => onNavigate('/chat')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-xs font-semibold transition-all shadow-sm"
        >
          <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="hidden md:inline">AI Assistant</span>
        </button>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 transition-all relative shadow-sm"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-[#0F1420]">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] rounded-2xl shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#232A3D]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Critical Alerts</span>
                </div>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigate('/alerts');
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  View All
                </button>
              </div>

              <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
                {alerts.slice(0, 4).map((alt) => (
                  <div
                    key={alt.id}
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('/alerts');
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161B2C] hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-[#232A3D] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{alt.title}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{alt.createdAt}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">{alt.message}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-[#232A3D] text-center">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigate('/notifications');
                  }}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium"
                >
                  Go to Notifications Hub →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
