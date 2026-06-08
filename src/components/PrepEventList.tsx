import { ChevronRight } from 'lucide-react';
import { Event } from '../types';
import { fmtDateJP, fmtDateRange, daysUntil } from '../lib/eventHelpers';

interface PrepEventListProps {
  events: Event[];
  onSelectEvent: (ev: Event) => void;
}

export default function PrepEventList({ events, onSelectEvent }: PrepEventListProps) {
  const today = new Date().toISOString().slice(0, 10);
  const activeEvents = [...events]
    .filter(ev => ev.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

  // 月ごとにグループ化
  const monthGroups: { month: string; events: Event[] }[] = [];
  for (const ev of activeEvents) {
    const [y, m] = ev.start.split('-');
    const label = `${parseInt(y)}年${parseInt(m)}月`;
    const last = monthGroups[monthGroups.length - 1];
    if (last?.month === label) last.events.push(ev);
    else monthGroups.push({ month: label, events: [ev] });
  }

  return (
    <div className="relative z-10 flex flex-col h-full overflow-y-auto pb-20">
      <div className="px-4 py-4">
        <h2 className="text-base font-black text-white mb-4">準備物リスト</h2>
        {activeEvents.length === 0 ? (
          <div className="text-center py-12 text-white/50 text-sm">進行中のイベントがありません</div>
        ) : (
          <div className="flex flex-col gap-5">
            {monthGroups.map(({ month, events: evs }) => (
              <div key={month}>
                <div className="text-[11px] font-black text-white/60 uppercase tracking-widest px-1 mb-2">{month}</div>
                <div className="flex flex-col gap-2">
                  {evs.map(ev => {
                    const s = fmtDateJP(ev.start);
                    const until = daysUntil(ev.start);
                    const isToday = until === 0;
                    const isSoon = until > 0 && until <= 7;
                    const isOngoing = until < 0 && ev.end >= today;
                    const urgencyBadge = isToday
                      ? { label: '今日', cls: 'bg-red-500 text-white' }
                      : isOngoing
                      ? { label: '開催中', cls: 'bg-emerald-500 text-white' }
                      : isSoon
                      ? { label: `${until}日後`, cls: 'bg-amber-400 text-white' }
                      : null;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvent(ev)}
                        className="w-full text-left bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 flex items-stretch overflow-hidden hover:bg-white/15 active:scale-[0.98] transition-all"
                      >
                        {/* 日付バッジ */}
                        <div className={`flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0 ${isToday ? 'bg-red-500' : isOngoing ? 'bg-emerald-500' : isSoon ? 'bg-amber-400' : 'bg-indigo-600'}`}>
                          <span className="text-[10px] font-black text-white/70 leading-none">{s.month}月</span>
                          <span className="text-xl font-black text-white leading-none mt-0.5">{s.day}</span>
                          <span className="text-[10px] font-black text-white/80 leading-none mt-0.5">{s.dow}</span>
                        </div>
                        {/* コンテンツ */}
                        <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-white text-sm truncate">{ev.venue}</span>
                            {urgencyBadge && (
                              <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}>{urgencyBadge.label}</span>
                            )}
                          </div>
                          <div className="text-xs text-white/50 truncate">{fmtDateRange(ev.start, ev.end)}</div>
                        </div>
                        <div className="flex items-center pr-3">
                          <ChevronRight size={16} className="text-white/30 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
