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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
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
        className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl max-md:max-h-[92dvh] max-md:rounded-b-none max-md:border-b-0 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl lg:max-w-3xl xl:max-w-4xl md:rounded-3xl w-full"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 md:hidden" aria-hidden />
        <div className="p-5 md:p-6 border-b border-slate-200 flex justify-between items-start gap-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {year}年{month}月{day}日
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">この日のイベント {events.length} 件</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 md:p-5 md:grid md:grid-cols-2 md:gap-3 md:auto-rows-min space-y-2 md:space-y-0 flex-1 min-h-0">
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
                className="flex min-h-11 w-full items-center text-left rounded-xl border border-solid border-slate-200 bg-white px-3 py-2 shadow-sm overflow-hidden transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex min-h-0 w-full items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full border border-slate-200"
                    style={{ backgroundColor: typeSty.border }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="font-bold text-sm text-slate-900 truncate block">{ev.venue}</span>
                    {optionalLine ? (
                      <span className="text-[11px] font-medium text-slate-500 truncate block mt-0.5">{optionalLine}</span>
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
