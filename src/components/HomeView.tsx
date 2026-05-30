import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ClipboardList, Plus, CalendarDays } from 'lucide-react';
import type { Event } from '../types';

interface Props {
  events: Event[];
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (event: Event) => void;
  onNavigateToPrepList: () => void;
  onCreateEvent: () => void;
  onOpenSchedule: () => void;
}

function statusPill(status?: string) {
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-100 text-amber-800' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-blue-100 text-blue-800' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-emerald-100 text-emerald-800' };
    case 'completed':   return { label: '終了',      cls: 'bg-orange-100 text-orange-800' };
    case 'cancelled':   return { label: 'キャンセル',cls: 'bg-red-100 text-red-700' };
    default:            return { label: '予定',      cls: 'bg-slate-100 text-slate-600' };
  }
}

function fmtRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    const dow = ['日','月','火','水','木','金','土'][dt.getDay()];
    return `${dt.getMonth()+1}/${dt.getDate()}(${dow})`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} → ${fmt(end)}`;
}

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function EventCard({ ev, prog, onSelect }: {
  ev: Event;
  prog?: { total: number; done: number };
  onSelect: (e: Event) => void;
}) {
  const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : -1;
  const st = statusPill(ev.status);

  return (
    <motion.button
      onClick={() => onSelect(ev)}
      whileHover={{ y: -2 }}
      className="w-full text-left bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-black text-slate-800 truncate">{ev.venue}</span>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${st.cls}`}>{st.label}</span>
          </div>
          <div className="text-xs text-slate-500 mb-2">
            {fmtRange(ev.start, ev.end)}{ev.client ? ` · ${ev.client}` : ''}
            {ev.region ? ` · ${ev.region}` : ''}
          </div>
          {pct >= 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 font-mono shrink-0">{prog!.done}/{prog!.total}</span>
            </div>
          )}
        </div>
        <ChevronRight size={15} className="text-slate-300 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
      </div>
    </motion.button>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl py-6 text-center text-sm text-white/50">
      {label}はありません
    </div>
  );
}

export default function HomeView({ events, prepProgressMap, onSelectEvent, onNavigateToPrepList, onCreateEvent, onOpenSchedule }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const nextWeekEnd = addDays(today, 7);

  const { todayEvents, nextWeekEvents } = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled');
    const todayEvents = active.filter(e =>
      e.start <= today && today <= (e.end || e.start)
    ).sort((a, b) => a.start.localeCompare(b.start));

    const nextWeekEvents = active.filter(e =>
      e.start > today && e.start <= nextWeekEnd
    ).sort((a, b) => a.start.localeCompare(b.start));

    return { todayEvents, nextWeekEvents };
  }, [events, today, nextWeekEnd]);

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/mercury-office.jpg')" }}
      />
      {/* グラデーションオーバーレイ（上部は写真を活かし、下部にかけて濃く） */}
      <div
        className="fixed inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(15,23,42,0.30) 0%, rgba(15,23,42,0.55) 45%, rgba(15,23,42,0.78) 100%)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-5 px-4 pt-6 pb-32 max-w-xl mx-auto w-full">

        {/* Date header */}
        <div className="text-white">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">TODAY</div>
          <div className="text-2xl font-black leading-tight">
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {/* 今日のイベント */}
        <div>
          <div className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-2">本日のイベント</div>
          {todayEvents.length === 0
            ? <EmptySection label="本日のイベント" />
            : <div className="flex flex-col gap-2">
                {todayEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} prog={prepProgressMap[ev.id]} onSelect={onSelectEvent} />
                ))}
              </div>
          }
        </div>

        {/* 来週のイベント */}
        <div>
          <div className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-2">来週のイベント（7日以内）</div>
          {nextWeekEvents.length === 0
            ? <EmptySection label="来週のイベント" />
            : <div className="flex flex-col gap-2">
                {nextWeekEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} prog={prepProgressMap[ev.id]} onSelect={onSelectEvent} />
                ))}
              </div>
          }
        </div>

        {/* クイックアクション */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-1">クイックアクション</div>

          <button
            onClick={onNavigateToPrepList}
            className="flex items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            <ClipboardList size={18} className="text-indigo-600 shrink-0" />
            準備物リスト
          </button>

          <button
            onClick={onCreateEvent}
            className="flex items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            <Plus size={18} className="text-emerald-600 shrink-0" strokeWidth={3} />
            新規イベントを追加する
          </button>

          <button
            onClick={onOpenSchedule}
            className="flex items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            <CalendarDays size={18} className="text-violet-600 shrink-0" />
            スケジュール
          </button>
        </div>
      </div>
    </div>
  );
}
