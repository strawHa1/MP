import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, TrendingUp, CheckCircle2, ExternalLink } from 'lucide-react';
import { RecommendedActionItem } from '../../lib/useDashboardIntelligence';

interface RecommendedActionModalProps {
  action: RecommendedActionItem | null;
  onClose: () => void;
  onConfirmExecute: (action: RecommendedActionItem) => void;
  onOpenPortfolioReview: (action: RecommendedActionItem) => void;
}

export const RecommendedActionModal: React.FC<RecommendedActionModalProps> = ({
  action,
  onClose,
  onConfirmExecute,
  onOpenPortfolioReview
}) => {
  useEffect(() => {
    if (!action) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [action, onClose]);

  if (!action) return null;

  const isExecute = action.type === 'execute';

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#0F1420] border border-[#232A3D] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#232A3D] flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              {isExecute ? <ShieldAlert className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {isExecute ? 'Hedge Execution Plan' : 'Rebalance Review'}
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{action.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{action.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#161B2C] text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="bg-[#161B2C] border border-[#232A3D] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Ticker</span>
              <span className="text-white font-bold">${action.ticker}</span>
            </div>
            {action.currentAllocationPct != null && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-500">Current allocation</span>
                <span className="text-white">{action.currentAllocationPct}%</span>
              </div>
            )}
            {action.targetAllocationPct != null && (
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-500">Target allocation</span>
                <span className="text-emerald-400 font-bold">{action.targetAllocationPct}%</span>
              </div>
            )}
            {action.hedgeInstrument && (
              <div className="flex justify-between text-xs font-mono gap-4">
                <span className="text-slate-500 shrink-0">Instrument</span>
                <span className="text-blue-300 text-right">{action.hedgeInstrument}</span>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Rationale</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{action.rationale}</p>
          </div>

          {action.relatedHeadline && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <p className="text-[10px] font-bold text-purple-300 uppercase mb-1">Linked live headline</p>
              <p className="text-xs text-slate-200">{action.relatedHeadline}</p>
            </div>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed border-t border-[#232A3D] pt-3">
            This is a risk-planning workflow — not live trade execution. Confirming logs your intent and opens portfolio tools for follow-through.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {isExecute ? (
              <button
                type="button"
                onClick={() => onConfirmExecute(action)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Hedge Plan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenPortfolioReview(action)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Portfolio Review
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-300 font-bold text-xs hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
