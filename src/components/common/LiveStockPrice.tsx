import React from 'react';
import { useLiveQuote } from '../../lib/stockService';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface LiveStockPriceProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export const LiveStockPrice: React.FC<LiveStockPriceProps> = ({
  symbol,
  size = 'md',
  showDetails = true,
  className = ''
}) => {
  const { quote, loading, refresh } = useLiveQuote(symbol, 15000);

  if (loading && !quote) {
    return (
      <div className={`animate-pulse flex items-center gap-2 ${className}`}>
        <div className="h-5 w-16 bg-slate-800 rounded"></div>
        <div className="h-4 w-12 bg-slate-800/80 rounded"></div>
      </div>
    );
  }

  if (!quote) return <span className="text-slate-500 text-xs">--</span>;

  const isPositive = quote.change >= 0;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
  const bgBadgeClass = isPositive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400';

  const fontSizes = {
    sm: { price: 'text-sm font-semibold', change: 'text-[11px]', icon: 'w-3 h-3' },
    md: { price: 'text-lg font-bold', change: 'text-xs', icon: 'w-3.5 h-3.5' },
    lg: { price: 'text-2xl font-extrabold', change: 'text-sm', icon: 'w-4 h-4' }
  };

  const sf = fontSizes[size];

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-slate-100 font-mono ${sf.price}`}>
          ${quote.price.toFixed(2)}
        </span>

        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${bgBadgeClass} ${sf.change} font-mono font-medium`}>
          {isPositive ? <TrendingUp className={sf.icon} /> : <TrendingDown className={sf.icon} />}
          {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.percentChange.toFixed(2)}%)
        </span>
      </div>

      {showDetails && (
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-sans">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${quote.isMarketOpen ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="font-medium text-slate-300">
              {quote.isMarketOpen ? 'LIVE' : 'Last close'}
            </span>
          </span>
          <span>•</span>
          <span className="text-slate-400">as of {quote.lastUpdated}</span>
          <button
            onClick={() => refresh()}
            title="Refresh live quote"
            className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
