import { ChevronRight } from 'lucide-react';
import { Event } from '../types';
import { fmtDateJP, fmtDateRange, prepEventUrgency } from '../lib/eventHelpers';
import EventPickerTable from './EventPickerTable';

interface PrepEventListProps {
  events: Event[];
  onSelectEvent: (ev: Event) => void;
}

export default function PrepEventList({ events, onSelectEvent }: PrepEventListProps) {
  const today = new Date().toISOString().slice(0, 10);
  const activeEvents = [...events]
    .filter(ev => ev.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

  const monthGroups: { month: string; events: Event[] }[] = [];
  for (const ev of activeEvents) {
    const [y, m] = ev.start.split('-');
    const label = `${parseInt(y)}年${parseInt(m)}月`;
    const last = monthGroups[monthGroups.length - 1];
    if (last?.month === label) last.events.push(ev);
    else monthGroups.push({ month: label, events: [ev] });
  }

  return (
    <div className="relative z-10 flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-8">
      <div className="px-4 md:px-6 py-4 w-full max-w-none">
        <div className="mb-6">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PREPARATION</div>
          <h2 className="text-2xl font-black text-slate-900">準備物リスト</h2>
          <p className="hidden md:block text-xs text-slate-400 mt-2">進行中のイベントを選択して準備物を管理します</p>
        </div>
        {activeEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">進行中のイベントがありません</div>
        ) : (
          <>
          <EventPickerTable events={activeEvents} onSelect={onSelectEvent} variant="active" />
          <div className="md:hidden flex flex-col gap-5 mt-0">
            {monthGroups.map(({ month, events: evs }) => (
              <div key={month}>
                <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1 mb-2">{month}</div>
                <div className="flex flex-col gap-2">
                  {evs.map(ev => {
                    const s = fmtDateJP(ev.start);
                    const urgency = prepEventUrgency(ev.start, ev.end);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvent(ev)}
                        className={`w-full text-left rounded-2xl border border-slate-200 shadow-sm flex items-stretch overflow-hidden active:scale-[0.98] transition-all ${urgency.rowBg}`}
                      >
                        <div className={`flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0 ${urgency.dateBadgeCls}`}>
                          <span className="text-[10px] font-black text-white/90 leading-none">{s.month}月</span>
                          <span className="text-xl font-black text-white leading-none mt-0.5">{s.day}</span>
                          <span className="text-[10px] font-black text-white/90 leading-none mt-0.5">{s.dow}</span>
                        </div>
                        <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-slate-900 text-sm truncate">{ev.venue}</span>
                            <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${urgency.badgeCls}`}>
                              {urgency.daysLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-xs text-slate-500 truncate">{fmtDateRange(ev.start, ev.end)}</span>
                            {(ev.prepItemTotal ?? 0) > 0 ? (
                              <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                (ev.prepItemDone ?? 0) >= (ev.prepItemTotal ?? 0)
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {ev.prepItemDone ?? 0}/{ev.prepItemTotal}件着荷
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-black text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">
                                準備物なし
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center pr-3">
                          <ChevronRight size={16} className="text-slate-400 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
