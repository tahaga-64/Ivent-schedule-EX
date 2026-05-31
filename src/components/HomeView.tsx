import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ClipboardList, Plus, CalendarDays } from 'lucide-react';
import type { Event } from '../types';
import { rs, ts } from '../lib/eventHelpers';

interface Props {
  events: Event[];
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (event: Event) => void;
  onNavigateToPrepList: () => void;
  onCreateEvent: () => void;
  onOpenSchedule: () => void;
}

function effectivePast(ev: Event, today: string): boolean {
  if (ev.status === 'cancelled') return false;
  return (ev.end || ev.start) < today;
}

function statusPill(status: string | undefined, isPast: boolean): { label: string; cls: string } | null {
  if (isPast || status === 'completed') return { label: '完了', cls: 'bg-slate-900 text-white' };
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-500 text-white' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-blue-500 text-white' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-blue-500 text-white' };
    case 'cancelled':   return { label: 'キャンセル',cls: 'bg-red-400/80 text-white' };
    default:            return null;
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

function daysUntil(start: string, today: string): number {
  return Math.ceil((new Date(start + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
}

function EventCard({ ev, prog, today, onSelect }: {
  ev: Event;
  prog?: { total: number; done: number };
  today: string;
  onSelect: (e: Event) => void;
}) {
  const past = effectivePast(ev, today);
  const st = statusPill(ev.status, past);
  const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : -1;
  const days = daysUntil(ev.start, today);
  const regionColor = rs(ev.region || '').dot;
  const emoji = ev.emoji || ts(ev.type || '').icon;

  return (
    <motion.button
      onClick={() => onSelect(ev)}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      className="w-full text-left bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all group overflow-hidden border border-slate-100/60"
    >
      <div className="flex items-stretch">
        <div className="w-1 shrink-0" style={{ background: regionColor }} />
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5 shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-base font-black text-slate-800 truncate">{ev.venue}</span>
                {st && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${st.cls}`}>{st.label}</span>
                )}
                {!past && days === 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white">今日</span>
                )}
                {!past && days > 0 && days <= 3 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">{days}日後</span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {fmtRange(ev.start, ev.end)}{ev.client ? ` · ${ev.client}` : ''}{ev.region ? ` · ${ev.region}` : ''}
              </div>
              {pct >= 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{prog!.done}/{prog!.total}</span>
                </div>
              )}
            </div>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-indigo-400 shrink-0 mt-1 transition-colors" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl py-5 text-center text-sm text-white/40">
      {label}
    </div>
  );
}

export default function HomeView({ events, prepProgressMap, onSelectEvent, onNavigateToPrepList, onCreateEvent, onOpenSchedule }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const in7  = addDays(today, 7);

  const { todayEvents, upcomingWeek } = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled');
    const todayEvents = active.filter(e =>
      e.start && e.start <= today && today <= (e.end || e.start)
    ).sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    const upcomingWeek = active.filter(e =>
      e.start && e.start > today && e.start <= in7
    ).sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    return { todayEvents, upcomingWeek };
  }, [events, today, in7]);

  const stats = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled' && e.start && !effectivePast(e, today));
    const thisMonth = events.filter(e => e.status !== 'cancelled' && e.start?.startsWith(today.slice(0, 7)));
    let totalItems = 0, doneItems = 0;
    for (const ev of active.slice(0, 15)) {
      const p = prepProgressMap[ev.id];
      if (p?.total) { totalItems += p.total; doneItems += p.done; }
    }
    const prepPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : null;
    return { upcoming: active.length, thisMonthCount: thisMonth.length, prepPct };
  }, [events, prepProgressMap, today]);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 flex flex-col gap-5 px-4 pt-6 pb-32 max-w-xl mx-auto w-full">

        {/* Date header */}
        <div className="flex items-end gap-4 text-white">
          <div className="text-8xl font-black leading-none tracking-tighter">
            {new Date().getDate()}
          </div>
          <div className="pb-2 flex flex-col gap-0.5">
            <div className="text-xl font-black opacity-90 leading-tight">
              {new Date().toLocaleDateString('ja-JP', { month: 'long', weekday: 'long' })}
            </div>
            <div className="text-sm font-bold opacity-40">{new Date().getFullYear()}</div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
            <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">今月</div>
            <div className="text-2xl font-black text-white leading-none">{stats.thisMonthCount}</div>
            <div className="text-[10px] text-white/40 mt-0.5">件</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
            <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">予定</div>
            <div className="text-2xl font-black text-white leading-none">{stats.upcoming}</div>
            <div className="text-[10px] text-white/40 mt-0.5">件</div>
          </div>
          <div className={`backdrop-blur-sm rounded-2xl p-3.5 border ${
            stats.prepPct === null
              ? 'bg-white/10 border-white/15'
              : stats.prepPct === 100
                ? 'bg-emerald-500/20 border-emerald-400/30'
                : stats.prepPct >= 70
                  ? 'bg-indigo-500/20 border-indigo-400/30'
                  : 'bg-amber-500/20 border-amber-400/30'
          }`}>
            <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">準備率</div>
            <div className="text-2xl font-black text-white leading-none">
              {stats.prepPct !== null ? `${stats.prepPct}` : '—'}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{stats.prepPct !== null ? '%' : ''}</div>
          </div>
        </div>

        {/* 本日のイベント */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-4 bg-white/40 rounded-full shrink-0" />
            <div className="text-[11px] font-black text-white/70 uppercase tracking-widest">本日のイベント</div>
            {todayEvents.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black text-white">{todayEvents.length}</span>
            )}
          </div>
          {todayEvents.length === 0
            ? <SectionEmpty label="本日のイベントはありません" />
            : <div className="flex flex-col gap-2">
                {todayEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} prog={prepProgressMap[ev.id]} today={today} onSelect={onSelectEvent} />
                ))}
              </div>
          }
        </div>

        {/* 来週のイベント */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-4 bg-white/40 rounded-full shrink-0" />
            <div className="text-[11px] font-black text-white/70 uppercase tracking-widest">来週のイベント</div>
          </div>
          {upcomingWeek.length === 0
            ? <SectionEmpty label="来週のイベントはありません" />
            : <div className="flex flex-col gap-2">
                {upcomingWeek.map(ev => (
                  <EventCard key={ev.id} ev={ev} prog={prepProgressMap[ev.id]} today={today} onSelect={onSelectEvent} />
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
            {stats.prepPct !== null && stats.prepPct < 100 && (
              <span className="ml-auto text-xs font-black text-slate-400">{stats.prepPct}%</span>
            )}
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
