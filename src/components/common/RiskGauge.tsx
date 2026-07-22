import React from 'react';

interface RiskGaugeProps {
  score: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showCategory?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  size = 'md',
  label = 'Risk Score',
  showCategory = true
}) => {
  const normalizedScore = Math.min(100, Math.max(0, score));

  let color = '#22C55E'; // green
  let category = 'Low Risk';
  let badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  if (normalizedScore >= 75) {
    color = '#EF4444'; // red
    category = 'Critical Risk';
    badgeBg = 'bg-red-500/10 text-red-400 border-red-500/20';
  } else if (normalizedScore >= 55) {
    color = '#F59E0B'; // amber
    category = 'High Risk';
    badgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  } else if (normalizedScore >= 35) {
    color = '#3B82F6'; // blue
    category = 'Medium Risk';
    badgeBg = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }

  const sizes = {
    sm: { width: 100, height: 60, stroke: 8, fontSize: 'text-xl', labelSize: 'text-[10px]' },
    md: { width: 140, height: 80, stroke: 10, fontSize: 'text-2xl', labelSize: 'text-xs' },
    lg: { width: 180, height: 100, stroke: 12, fontSize: 'text-3xl', labelSize: 'text-sm' }
  };

  const s = sizes[size];
  const radius = (s.width - s.stroke * 2) / 2;
  const circumference = Math.PI * radius; // semi-circle arc length
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center">
        <svg width={s.width} height={s.height} className="overflow-visible">
          {/* Background Arc */}
          <path
            d={`M ${s.stroke} ${s.height - 5} A ${radius} ${radius} 0 0 1 ${s.width - s.stroke} ${s.height - 5}`}
            fill="none"
            stroke="#1E293B"
            strokeWidth={s.stroke}
            strokeLinecap="round"
          />
          {/* Colored Score Arc */}
          <path
            d={`M ${s.stroke} ${s.height - 5} A ${radius} ${radius} 0 0 1 ${s.width - s.stroke} ${s.height - 5}`}
            fill="none"
            stroke={color}
            strokeWidth={s.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center score text */}
        <div className="absolute bottom-1 flex flex-col items-center justify-center">
          <span className={`font-black text-slate-100 ${s.fontSize} tracking-tight font-mono`}>
            {normalizedScore}
          </span>
          <span className={`text-slate-400 font-medium ${s.labelSize} -mt-1 uppercase tracking-wider`}>
            / 100
          </span>
        </div>
      </div>

      {showCategory && (
        <span className={`mt-2 px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${badgeBg}`}>
          {category}
        </span>
      )}
      
      {label && <span className="text-xs text-slate-400 mt-1 font-medium">{label}</span>}
    </div>
  );
};
