import React from 'react';
import { RiskSeverity } from '../../types';

interface SeverityBadgeProps {
  severity: RiskSeverity | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md', className = '' }) => {
  const norm = (severity || 'medium').toLowerCase();

  let bg = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  let dot = 'bg-blue-400';
  let label = severity;

  if (norm === 'critical') {
    bg = 'bg-red-500/15 text-red-400 border-red-500/30';
    dot = 'bg-red-500 animate-pulse';
    label = 'CRITICAL';
  } else if (norm === 'high') {
    bg = 'bg-red-500/10 text-red-400 border-red-500/20';
    dot = 'bg-red-400';
    label = 'HIGH RISK';
  } else if (norm === 'medium') {
    bg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    dot = 'bg-amber-400';
    label = 'MEDIUM RISK';
  } else if (norm === 'low' || norm === 'safe') {
    bg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    dot = 'bg-emerald-400';
    label = 'LOW RISK';
  } else if (norm === 'neutral') {
    bg = 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    dot = 'bg-slate-400';
    label = 'NEUTRAL';
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1 font-semibold',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-semibold',
    lg: 'px-3 py-1.5 text-sm gap-2 font-bold'
  };

  return (
    <span className={`inline-flex items-center rounded-full border tracking-wide uppercase ${bg} ${sizeClasses[size]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
};
