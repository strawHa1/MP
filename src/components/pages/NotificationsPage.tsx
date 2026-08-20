import React from 'react';
import { AlertItem } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';

interface NotificationsPageProps {
  onNavigate: (path: string) => void;
  alerts: AlertItem[];
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate, alerts }) => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Notifications Hub</h1>
          <p className="text-slate-400 text-xs mt-0.5">High-priority operational alerts and system activity</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((n) => (
          <div
            key={n.id}
            onClick={() => onNavigate('/alerts')}
            className="p-4 rounded-2xl bg-[#0F1420] border border-[#232A3D] hover:border-slate-500 cursor-pointer transition-all flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <SeverityBadge severity={n.severity} size="sm" />
              <div>
                <h4 className="text-xs font-bold text-white">{n.title}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{n.message}</p>
              </div>
            </div>

            <span className="text-[10px] text-slate-500 font-mono shrink-0">{n.createdAt}</span>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-xs bg-[#0F1420] border border-[#232A3D] rounded-2xl">
            No live notifications yet.
          </div>
        )}
      </div>
    </div>
  );
};
