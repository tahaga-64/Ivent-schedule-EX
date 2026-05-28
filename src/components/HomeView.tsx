import { useMemo } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, ChevronRight, Clock } from 'lucide-react';
import type { Event } from '../types';

interface Props {
  events: Event[];
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (event: Event) => void;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  in_progress: { label: '準備中',    bg: '#fde68a', color: '#78350f', border: '#fbbf24' },
  waiting:     { label: '入荷待ち',  bg: '#bfdbfe', color: '#1e3a8a', border: '#93c5fd' },
  ready:       { label: '準備完了',  bg: '#a7f3d0', color: '#064e3b', border: '#6ee7b7' },
  completed:   { label: '終了',      bg: '#fed7aa', color: '#7c2d12', border: '#fdba74' },
  cancelled:   { label: 'キャンセル',bg: '#fecaca', color: '#7f1d1d', border: '#fca5a5' },
  scheduled:   { label: '予定',      bg: '#e2e8f0', color: '#334155', border: '#cbd5e1' },
};

function statusPill(status?: string) {
  return STATUS_STYLE[status ?? 'scheduled'] ?? STATUS_STYLE.scheduled;
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

function daysUntil(start: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((new Date(start+'T00:00:00').getTime() - today.getTime()) / 86400000);
}

function EventCard({ ev, prog, today, onSelect }: {
  ev: Event;
  prog?: { total: number; done: number };
  today: string;
  onSelect: (e: Event) => void;
}) {
  const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : -1;
  const d = daysUntil(ev.start);
  const st = statusPill(ev.status);
  const isOngoing = ev.start <= today && today <= (ev.end || ev.start);

  return (
    <motion.button
      onClick={() => onSelect(ev)}
      className="w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 hover:border-indigo-200 hover:shadow-md transition-all group"
      whileHover={{ y: -1 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-black text-[var(--text-primary)] truncate">{ev.venue}</span>
            <span
              className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
            >
              {st.label}
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mb-2">
            {fmtRange(ev.start, ev.end)}{ev.client ? ` · ${ev.client}` : ''}
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isOngoing ? (
            <span className="text-[10px] font-black text-emerald-500">開催中</span>
          ) : (
            <span className={`text-xs font-black ${d <= 3 ? 'text-red-500' : d <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
              あと{d}日
            </span>
          )}
          <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
        </div>
      </div>
    </motion.button>
  );
}

function Section({ title, items, emptyText, today, prepProgressMap, onSelectEvent }: {
  title: string;
  items: Event[];
  emptyText: string;
  today: string;
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (e: Event) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(ev => (
            <EventCard
              key={ev.id}
              ev={ev}
              prog={prepProgressMap[ev.id]}
              today={today}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomeView({ events, prepProgressMap, onSelectEvent }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const { todayEvents, upcoming, overdue } = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled');
    const todayEvents = active.filter(e => e.start <= today && today <= (e.end || e.start));
    const upcoming = active
      .filter(e => e.start > today)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 30);
    const overdue = active.filter(e => (e.end || e.start) < today && e.status !== 'completed' && e.status !== 'ready');
    return { todayEvents, upcoming, overdue };
  }, [events, today]);

  return (
    <div className="flex flex-col gap-6 p-4 pb-24 max-w-2xl mx-auto w-full">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
        <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">TODAY</div>
        <div className="text-2xl font-black leading-tight mb-3">
          {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
        <div className="flex items-center gap-5 text-sm opacity-90">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            <span>開催中 <strong>{todayEvents.length}</strong>件</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>直近 <strong>{upcoming.length}</strong>件</span>
          </div>
        </div>
      </div>

      {todayEvents.length > 0 && (
        <Section title="本日開催中" items={todayEvents} emptyText="" today={today} prepProgressMap={prepProgressMap} onSelectEvent={onSelectEvent} />
      )}
      {overdue.length > 0 && (
        <Section title="期限超過（要確認）" items={overdue} emptyText="" today={today} prepProgressMap={prepProgressMap} onSelectEvent={onSelectEvent} />
      )}
      <Section title="直近のイベント" items={upcoming} emptyText="直近の予定はありません" today={today} prepProgressMap={prepProgressMap} onSelectEvent={onSelectEvent} />
    </div>
  );
}
