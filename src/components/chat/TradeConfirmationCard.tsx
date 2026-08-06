import React from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { TradeAction } from '../../lib/portfolioService';

export interface TradeConfirmationData {
  action: TradeAction;
  ticker: string;
  companyName: string;
  amount: number;
  price: number;
  shares: number;
  cashBalance: number;
  /** Present for withdrawals so the user can see what the position is worth. */
  positionValue?: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface TradeConfirmationCardProps {
  data: TradeConfirmationData;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

const money = (value: number, decimals = 2) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

/**
 * Pending-order card shown inside the chat. No trade is ever executed until the
 * user presses Confirm here — the parser only ever creates this card.
 */
export const TradeConfirmationCard: React.FC<TradeConfirmationCardProps> = ({
  data,
  onConfirm,
  onCancel,
  busy = false
}) => {
  const isInvest = data.action === 'invest';

  return (
    <div
      className={`mt-2 rounded-2xl border overflow-hidden ${
        isInvest
          ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/5'
          : 'border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/5'
      }`}
    >
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-200/70 dark:border-[#232A3D]">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isInvest
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}
        >
          {isInvest ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
            Confirm {isInvest ? 'Investment' : 'Withdrawal'}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
            ${data.ticker} · {data.companyName}
          </p>
        </div>
      </div>

      <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Amount</dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">{money(data.amount)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Live price</dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">{money(data.price)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            Est. shares {isInvest ? 'bought' : 'sold'}
          </dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">{data.shares.toFixed(4)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            {isInvest ? 'Available cash' : 'Position value'}
          </dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">
            {money(isInvest ? data.cashBalance : data.positionValue ?? 0)}
          </dd>
        </div>
      </dl>

      {data.status === 'pending' ? (
        <div className="px-4 pb-3 space-y-2">
          <p className="flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3 h-3 mt-px shrink-0" />
            Nothing is executed until you confirm. Shares are estimated at the current price.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              disabled={busy}
              className={`flex-1 px-3 py-2 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                isInvest ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Confirm {isInvest ? 'Investment' : 'Withdrawal'}
            </button>
            <button
              onClick={onCancel}
              disabled={busy}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] text-slate-700 dark:text-slate-300 font-bold text-xs hover:border-slate-400 transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg ${
              data.status === 'confirmed'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
            }`}
          >
            {data.status === 'confirmed' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {data.status === 'confirmed' ? 'Order confirmed' : 'Order cancelled'}
          </span>
        </div>
      )}
    </div>
  );
};
