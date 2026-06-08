import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { Event } from '../types';
import { ts, buildEventOptionalCaption } from '../lib/eventHelpers';

interface DayDetailModalProps {
  year: number;
  month: number;
  day: number;
  events: Event[];
  onClose: () => void;
  onPickEvent: (ev: Event) => void;
}

export default function DayDetailModal({
  year,
  month,
  day,
  events,
  onClose,
  onPickEvent,
}: DayDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        onPointerDown={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border border-gray-100 bg-white shadow-2xl max-lg:max-h-[92dvh] max-lg:rounded-b-none max-lg:border-b-0 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:max-w-md lg:rounded-3xl w-full"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 lg:hidden" aria-hidden />
        <div className="p-5 lg:p-6 border-b border-slate-100 flex justify-between items-start gap-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              {year}年{month}月{day}日
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">この日のイベント {events.length} 件</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 lg:p-5 space-y-2 flex-1 min-h-0">
          {events.map((ev) => {
            const typeSty = ts(ev.type || "");
            const optionalLine = buildEventOptionalCaption(ev);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onPickEvent(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: typeSty.border,
                }}
                className="flex min-h-11 w-full items-center text-left rounded-xl border border-solid border-slate-200 bg-white px-3 py-2 shadow-sm ring-1 ring-inset ring-slate-900/[0.04] overflow-hidden transition hover:border-slate-300 hover:bg-slate-50/80"
              >
                <div className="flex min-h-0 w-full items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full border border-slate-900/15"
                    style={{ backgroundColor: typeSty.border }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="font-bold text-sm text-slate-900 truncate block">{ev.venue}</span>
                    {optionalLine ? (
                      <span className="text-[11px] font-medium text-slate-600 truncate block mt-0.5">{optionalLine}</span>
                    ) : null}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
