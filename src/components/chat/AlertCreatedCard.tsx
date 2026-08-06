import React from 'react';
import { BellRing, ExternalLink, Trash2 } from 'lucide-react';
import { UserAlert, describeCondition } from '../../lib/alertsService';

export interface AlertCreatedData {
  alert: UserAlert;
  removed?: boolean;
}

interface AlertCreatedCardProps {
  data: AlertCreatedData;
  onViewAlerts: () => void;
  onRemove: () => void;
}

/** Confirmation card shown after an alert is saved to the Alerts Center. */
export const AlertCreatedCard: React.FC<AlertCreatedCardProps> = ({
  data,
  onViewAlerts,
  onRemove
}) => {
  const { alert, removed } = data;
  const subjectLabel = alert.subjectType === 'stock' ? `$${alert.subject}` : `${alert.subject} risk index`;

  return (
    <div className="mt-2 rounded-2xl border border-blue-300 dark:border-blue-500/40 bg-blue-50/70 dark:bg-blue-500/5 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-blue-200/70 dark:border-blue-500/20">
        <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-xs font-extrabold text-slate-900 dark:text-white">
          {removed ? 'Alert removed' : 'Alert created'}
        </p>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className="text-[11px] text-slate-700 dark:text-slate-300">
          Notify me when{' '}
          <span className="font-bold text-slate-900 dark:text-white">{subjectLabel}</span>{' '}
          <span className="font-bold text-slate-900 dark:text-white">{describeCondition(alert)}</span>.
        </p>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-[#232A3D] text-slate-600 dark:text-slate-400">
            {alert.subjectType === 'stock' ? 'PRICE' : 'RISK INDEX'}
          </span>
          {alert.referenceValue !== undefined && (
            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-[#232A3D] text-slate-600 dark:text-slate-400">
              Now:{' '}
              {alert.subjectType === 'stock'
                ? `$${alert.referenceValue.toFixed(2)}`
                : `${alert.referenceValue}%`}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-lg border ${
              removed
                ? 'bg-slate-500/10 border-slate-300 dark:border-slate-600 text-slate-500'
                : 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {removed ? 'INACTIVE' : 'ACTIVE'}
          </span>
        </div>

        {!removed && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onViewAlerts}
              className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] text-slate-800 dark:text-slate-200 font-bold text-xs hover:border-slate-400 transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Alerts Center
            </button>
            <button
              onClick={onRemove}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] text-rose-600 dark:text-rose-400 font-bold text-xs hover:border-rose-400 transition-all flex items-center gap-1.5"
              title="Delete this alert"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
