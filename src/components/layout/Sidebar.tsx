import React from 'react';
import {
  LayoutDashboard,
  Globe2,
  Building2,
  PieChart,
  Map,
  Cpu,
  Briefcase,
  ShieldAlert,
  Flame,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { AlertItem } from '../../types';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  unreadAlertsCount?: number;
  liveEventsCount?: number;
  userName?: string;
  userPlan?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  unreadAlertsCount = 3,
  liveEventsCount = 0,
  userName = 'User',
  userPlan = 'Premium Plan',
  onLogout
}) => {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Global Events', path: '/events', icon: Flame, badge: liveEventsCount > 0 ? `${liveEventsCount} Live` : 'Live' },
    { label: 'Company Explorer', path: '/companies', icon: Building2 },
    { label: 'Sector Explorer', path: '/sectors', icon: Cpu },
    { label: 'World Risk Map', path: '/map', icon: Map },
    { label: 'AI Reports', path: '/reports', icon: Globe2 },
    { label: 'Portfolio Risk', path: '/portfolio', icon: Briefcase },
    { label: 'Alerts Center', path: '/alerts', icon: ShieldAlert, count: unreadAlertsCount }
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#0F1420] border-r border-slate-200 dark:border-[#232A3D] flex flex-col h-screen sticky top-0 z-30 select-none shadow-sm transition-colors">
      {/* Brand Logo */}
      <div 
        onClick={() => onNavigate('/dashboard')}
        className="p-5 border-b border-slate-200 dark:border-[#232A3D] flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md group-hover:scale-105 transition-transform">
            ∆
          </div>
          <div>
            <div className="font-extrabold tracking-wider text-slate-900 dark:text-slate-100 text-sm font-mono flex items-center gap-1.5">
              BLACK SWAN
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-tight">
              RISK INTELLIGENCE
            </div>
          </div>
        </div>
        <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-semibold">
          v2.4
        </span>
      </div>

      {/* Main Nav Items List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Intelligence Platform
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '?');

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#161B2C]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`} />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span className="text-[10px] bg-rose-100 dark:bg-red-500/20 text-rose-700 dark:text-red-400 border border-rose-300 dark:border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
                {item.count && item.count > 0 ? (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {item.count}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick User Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-[#232A3D] bg-slate-50/80 dark:bg-[#0A0E17]/60">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#161B2C]/80 border border-slate-200 dark:border-[#232A3D] shadow-sm">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500 p-0.5 shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256"
                alt={userName}
                className="w-full h-full rounded-[6px] object-cover"
              />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{userName}</div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold truncate">{userPlan}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign out"
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
