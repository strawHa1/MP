import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Bell,
  Clock,
  Filter,
  Check,
  Sliders,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { AlertItem } from '../../types';
import { INITIAL_ALERTS } from '../../data/mockData';
import { SeverityBadge } from '../common/SeverityBadge';
import {
  getUserAlerts,
  removeUserAlert,
  toAlertItem,
  USER_ALERTS_UPDATED_EVENT
} from '../../lib/alertsService';

/** Alerts created by the user in the AI Assistant chat carry this id prefix. */
const isCustomAlert = (id: string) => id.startsWith('ua-');

interface AlertsPageProps {
  onNavigate: (path: string) => void;
  userRiskTolerance?: number;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onNavigate,
  userRiskTolerance = 55
}) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'alt-risk-warning-1',
      title: 'CAPITAL LOSS WARNING: NVDA Exposure Risk Flagged',
      severity: 'critical',
      message: `NVIDIA ($NVDA) composite risk signal has degraded. Threat score (78/100) exceeds your configured risk tolerance threshold (${userRiskTolerance}/100). Elevated probability of position drawdown due to Taiwan export tariff escalation.`,
      read: false,
      createdAt: '3 mins ago',
      category: 'Capital Loss Warning',
      relatedEntitySymbol: 'NVDA'
    },
    ...INITIAL_ALERTS
  ]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Merge in alerts the user created from the AI Assistant chat. The service
  // fires USER_ALERTS_UPDATED_EVENT so new alerts appear without a reload.
  useEffect(() => {
    const sync = () => {
      const customItems = getUserAlerts().map(toAlertItem);
      setAlerts((prev) => {
        const readState = new Map(prev.map((a) => [a.id, a.read]));
        const platformAlerts = prev.filter((a) => !isCustomAlert(a.id));
        return [
          ...customItems.map((item) => ({ ...item, read: readState.get(item.id) ?? item.read })),
          ...platformAlerts
        ];
      });
    };

    sync();
    window.addEventListener(USER_ALERTS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(USER_ALERTS_UPDATED_EVENT, sync);
  }, []);

  const deleteCustomAlert = (id: string) => {
    removeUserAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const markAllRead = () => {
    setAlerts(alerts.map((a) => ({ ...a, read: true })));
  };

  const toggleRead = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, read: !a.read } : a)));
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'unread') return !a.read;
    if (filterSeverity === 'critical') return a.severity === 'critical';
    if (filterSeverity === 'high') return a.severity === 'high';
    if (filterSeverity === 'custom') return isCustomAlert(a.id);
    return true;
  });

  const customAlertCount = alerts.filter((a) => isCustomAlert(a.id)).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-rose-600 dark:text-red-400 font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-red-500 animate-pulse" />
            High-Frequency Risk & Signal Notification Hub
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">Alerts Center</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Real-time capital loss warnings & signal degradation alerts (Calibrated to {userRiskTolerance}/100 threshold)
          </p>
        </div>

        <button
          onClick={markAllRead}
          className="px-4 py-2 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] hover:border-slate-400 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-2 w-fit shadow-sm"
        >
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Mark All As Read
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'all', label: 'All Notifications' },
          { id: 'unread', label: 'Unread Only' },
          { id: 'critical', label: 'Critical Severity' },
          { id: 'high', label: 'High Severity' },
          { id: 'custom', label: `My Alerts${customAlertCount ? ` (${customAlertCount})` : ''}` }
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setFilterSeverity(pill.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterSeverity === pill.id
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'bg-white dark:bg-[#0F1420] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#232A3D] hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.map((alt) => (
          <div
            key={alt.id}
            className={`p-5 rounded-2xl border transition-all space-y-2 relative shadow-sm ${
              alt.category === 'Capital Loss Warning'
                ? 'bg-rose-50/80 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-950 dark:text-rose-100'
                : alt.read
                ? 'bg-white dark:bg-[#0F1420] border-slate-200 dark:border-[#232A3D] opacity-80'
                : 'bg-slate-50 dark:bg-[#161B2C] border-slate-300 dark:border-red-500/40 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={alt.severity} size="sm" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{alt.title}</h3>
                {!alt.read && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {alt.createdAt}
                </span>
                <button
                  onClick={() => toggleRead(alt.id)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Toggle Read"
                >
                  <CheckCircle2 className={`w-4 h-4 ${alt.read ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                </button>
                {isCustomAlert(alt.id) && (
                  <button
                    onClick={() => deleteCustomAlert(alt.id)}
                    className="text-slate-400 hover:text-rose-500"
                    title="Delete this alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans pl-1">
              {alt.message}
            </p>

            {alt.relatedEntitySymbol && (
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-[#232A3D]">
                <span className="text-[10px] font-mono font-bold bg-white dark:bg-[#0A0E17] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#232A3D] px-2 py-0.5 rounded">
                  Related Symbol: ${alt.relatedEntitySymbol}
                </span>
                <button
                  onClick={() => onNavigate(`/companies?symbol=${alt.relatedEntitySymbol}`)}
                  className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5" /> Review Position →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
