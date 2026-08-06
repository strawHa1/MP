import React from 'react';
import { CheckCircle2, Wallet, PieChart } from 'lucide-react';
import { PortfolioTransaction } from '../../lib/portfolioService';

export interface TradeReceiptData {
  transaction: PortfolioTransaction;
  /** Shares still held after the trade; 0 means the position was closed. */
  remainingShares: number;
  allocationPct: number;
}

interface TradeReceiptCardProps {
  data: TradeReceiptData;
  onViewPortfolio: () => void;
}

const money = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Post-execution summary shown after the user confirms a trade. */
export const TradeReceiptCard: React.FC<TradeReceiptCardProps> = ({ data, onViewPortfolio }) => {
  const { transaction } = data;
  const isInvest = transaction.action === 'invest';

  return (
    <div className="mt-2 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/5 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-emerald-200/70 dark:border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-xs font-extrabold text-slate-900 dark:text-white">
          {isInvest ? 'Investment executed' : 'Withdrawal executed'}
        </p>
        <span className="ml-auto text-[10px] font-mono text-slate-500 dark:text-slate-400">
          {transaction.id}
        </span>
      </div>

      <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Symbol</dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">${transaction.ticker}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            {isInvest ? 'Amount invested' : 'Amount withdrawn'}
          </dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">
            {money(transaction.amount)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Fill price</dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">{money(transaction.price)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Shares {isInvest ? 'added' : 'sold'}</dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">
            {transaction.shares.toFixed(4)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Position after</dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">
            {data.remainingShares > 0
              ? `${data.remainingShares.toFixed(4)} sh · ${data.allocationPct.toFixed(1)}%`
              : 'Closed'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Cash balance
          </dt>
          <dd className="font-bold text-slate-900 dark:text-white font-mono">
            {money(transaction.cashAfter)}
          </dd>
        </div>
      </dl>

      <div className="px-4 pb-3">
        <button
          onClick={onViewPortfolio}
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] text-slate-800 dark:text-slate-200 font-bold text-xs hover:border-slate-400 transition-all flex items-center justify-center gap-1.5"
        >
          <PieChart className="w-3.5 h-3.5" /> View in Portfolio Risk →
        </button>
      </div>
    </div>
  );
};
