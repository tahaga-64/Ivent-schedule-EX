import { ChevronRight } from 'lucide-react';
import { Event } from '../types';
import { fmtDateJP, fmtDateRange } from '../lib/eventHelpers';

interface ArchiveViewProps {
  events: Event[];
  onSelectEvent: (ev: Event) => void;
}

export default function ArchiveView({ events, onSelectEvent }: ArchiveViewProps) {
  const today = new Date().toISOString().slice(0, 10);
  const archivedEvents = [...events]
    .filter(ev => ev.end < today)
    .sort((a, b) => b.end.localeCompare(a.end));

  const monthGroups: { month: string; events: Event[] }[] = [];
  for (const ev of archivedEvents) {
    const [y, m] = ev.start.split('-');
    const label = `${parseInt(y)}年${parseInt(m)}月`;
    const last = monthGroups[monthGroups.length - 1];
    if (last?.month === label) last.events.push(ev);
    else monthGroups.push({ month: label, events: [ev] });
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20 bg-slate-50">
      <div className="px-4 py-4">
        <h2 className="text-base font-black text-slate-800 mb-1">アーカイブ</h2>
        <p className="text-xs text-slate-400 mb-4">終了したイベントの準備物を確認できます</p>
        {archivedEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">アーカイブされたイベントがありません</div>
        ) : (
          <div className="flex flex-col gap-5">
            {monthGroups.map(({ month, events: evs }) => (
              <div key={month}>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">{month}</div>
                <div className="flex flex-col gap-2">
                  {evs.map(ev => {
                    const s = fmtDateJP(ev.start);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvent(ev)}
                        className="w-full text-left bg-white/60 rounded-2xl border border-slate-100 shadow-sm flex items-stretch overflow-hidden hover:border-slate-300 hover:shadow-md transition-all opacity-80 hover:opacity-100"
                      >
                        {/* 日付バッジ（グレー） */}
                        <div className="flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0 bg-slate-200">
                          <span className="text-[10px] font-black text-slate-500 leading-none">{s.month}月</span>
                          <span className="text-xl font-black text-slate-500 leading-none mt-0.5">{s.day}</span>
                          <span className="text-[10px] font-black text-slate-400 leading-none mt-0.5">{s.dow}</span>
                        </div>
                        {/* コンテンツ */}
                        <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                          <div className="font-bold text-slate-600 text-sm truncate mb-0.5">{ev.venue}</div>
                          <div className="text-xs text-slate-400 truncate">{fmtDateRange(ev.start, ev.end)}</div>
                        </div>
                        <div className="flex items-center pr-3">
                          <ChevronRight size={16} className="text-slate-300 shrink-0" />
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
