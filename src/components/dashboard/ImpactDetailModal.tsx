import React from 'react';
import { X, ExternalLink, TrendingDown, TrendingUp, Newspaper, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { StockImpactRecord } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';

interface ImpactDetailModalProps {
  record: StockImpactRecord | null;
  onClose: () => void;
  onNavigateCompany: (ticker: string) => void;
}

function buildSparkline(record: StockImpactRecord) {
  const base = record.currentPrice;
  const change = record.actualChangePct / 100;
  return [
    { t: 'Open', p: Number((base / (1 + change)).toFixed(2)) },
    { t: '10:00', p: Number((base * (1 - change * 0.3)).toFixed(2)) },
    { t: '12:00', p: Number((base * (1 - change * 0.1)).toFixed(2)) },
    { t: '14:00', p: Number((base * (1 + change * 0.05)).toFixed(2)) },
    { t: 'Now', p: base }
  ];
}

export const ImpactDetailModal: React.FC<ImpactDetailModalProps> = ({
  record,
  onClose,
  onNavigateCompany
}) => {
  if (!record) return null;

  const sparkline = buildSparkline(record);
  const isUp = record.actualChangePct > 0;
  const predictedMid = ((record.projectedImpactPct.min + record.projectedImpactPct.max) / 2).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0F1420] border border-[#232A3D] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0F1420] border-b border-[#232A3D] p-5 flex items-start justify-between gap-4 z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">{record.companyName}</h2>
              <span className="text-xs font-mono text-slate-400 bg-[#161B2C] px-2 py-0.5 rounded border border-[#232A3D]">
                {record.ticker}
              </span>
              <SeverityBadge severity={record.severity} size="sm" />
            </div>
            <p className="text-xs text-slate-400 mt-1">{record.sector} • {record.country} • {record.region}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#161B2C] text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Price row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#161B2C] border border-[#232A3D] p-4 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Current Price</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">${record.currentPrice.toFixed(2)}</div>
            </div>
            <div className="bg-[#161B2C] border border-[#232A3D] p-4 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Today's Change</div>
              <div className={`text-2xl font-bold font-mono mt-1 flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {isUp ? '+' : ''}{record.actualChangePct.toFixed(2)}%
              </div>
            </div>
            <div className="bg-[#161B2C] border border-[#232A3D] p-4 rounded-xl">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Volume</div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {(record.volume / 1_000_000).toFixed(1)}M
              </div>
            </div>
          </div>

          {/* Predicted vs Actual */}
          <div className="bg-[#161B2C] border border-[#232A3D] p-4 rounded-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Predicted vs Actual Impact</h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500">AI Projected Range</span>
                <div className={`text-lg font-bold mt-1 ${record.sentiment === 'bearish' ? 'text-red-400' : record.sentiment === 'bullish' ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {record.projectedImpactLabel}
                </div>
                <span className="text-[10px] text-slate-500">Midpoint: {predictedMid}%</span>
              </div>
              <div>
                <span className="text-slate-500">Actual Market Move</span>
                <div className={`text-lg font-bold mt-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{record.actualChangePct.toFixed(2)}%
                </div>
                <span className="text-[10px] text-slate-500 capitalize">{record.sentiment} sentiment</span>
              </div>
            </div>
          </div>

          {/* Intraday chart */}
          <div className="bg-[#161B2C] border border-[#232A3D] p-4 rounded-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              Intraday Price (Session)
            </h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline}>
                  <XAxis dataKey="t" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748B" fontSize={10} tickLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F1420', borderColor: '#232A3D', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey="p" stroke={isUp ? '#10B981' : '#EF4444'} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* News context */}
          <div className="bg-[#161B2C] border border-[#232A3D] p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-purple-400" />
              Triggering News ({record.newsType === 'macro' ? 'Macro Event' : 'Company News'})
            </h3>
            <h4 className="text-sm font-bold text-slate-200">{record.headline}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{record.description}</p>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{record.source} • {record.timeAgo}</span>
              <a
                href={record.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Read source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <button
            onClick={() => { onClose(); onNavigateCompany(record.ticker); }}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs transition-all"
          >
            Open Full Company Analysis →
          </button>
        </div>
      </div>
    </div>
  );
};
