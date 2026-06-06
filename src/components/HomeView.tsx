import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, BookOpen, ExternalLink, X } from 'lucide-react';
import type { Event } from '../types';
import { rs, ts, fmtDateJP, fmtDateRange, daysUntil } from '../lib/eventHelpers';
import OperationsManualModal from './OperationsManualModal';

interface Props {
  events: Event[];
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (event: Event) => void;
  onSelectPrepEvent: (event: Event) => void;
  onCreateEvent: () => void;
  onOpenSchedule: () => void;
  canEditEvent: boolean;
}

function effectivePast(ev: Event, today: string): boolean {
  if (ev.status === 'cancelled') return false;
  return (ev.end || ev.start) < today;
}

function statusPill(status: string | undefined, isPast: boolean): { label: string; cls: string } | null {
  if (isPast || status === 'completed') return { label: '完了', cls: 'bg-slate-100 border border-slate-200 text-slate-500' };
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-50 border border-amber-200 text-amber-700' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-sky-50 border border-sky-300 text-sky-700' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-indigo-50 border border-indigo-200 text-indigo-700' };
    case 'cancelled':   return { label: 'キャンセル',cls: 'bg-red-50 border border-red-200 text-red-600' };
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

export default function HomeView({ events, prepProgressMap, onSelectEvent, onSelectPrepEvent, onCreateEvent, onOpenSchedule, canEditEvent }: Props) {
  const [showOpsManual, setShowOpsManual] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showPermissionToast, setShowPermissionToast] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!showPermissionToast) return;
    const t = setTimeout(() => setShowPermissionToast(false), 2500);
    return () => clearTimeout(t);
  }, [showPermissionToast]);
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

  const pickerEvents = useMemo(() => {
    return events
      .filter(ev => ev.status !== 'cancelled' && (ev.end || ev.start) >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events, today]);

  const pickerGroups = useMemo(() => {
    const groups: { month: string; events: Event[] }[] = [];
    for (const ev of pickerEvents) {
      const [y, m] = ev.start.split('-');
      const label = `${parseInt(y)}年${parseInt(m)}月`;
      const last = groups[groups.length - 1];
      if (last?.month === label) last.events.push(ev);
      else groups.push({ month: label, events: [ev] });
    }
    return groups;
  }, [pickerEvents]);

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
            onClick={() => setShowEventPicker(true)}
            className="flex items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            準備物リスト
            {stats.prepPct !== null && stats.prepPct < 100 && (
              <span className="ml-auto text-xs font-black text-slate-400">{stats.prepPct}%</span>
            )}
          </button>

          <button
            onClick={() => { if (canEditEvent) { onCreateEvent(); } else { setShowPermissionToast(true); } }}
            className="flex items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            新規イベントを追加する
          </button>

          <button
            onClick={onOpenSchedule}
            className="flex items-center gap-3 bg-white text-slate-800 rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            スケジュール
          </button>

          {/* 運用手順書: PC のみ表示 */}
          <button
            onClick={() => setShowOpsManual(true)}
            className="hidden lg:flex items-center gap-3 bg-white/15 border border-white/25 text-white rounded-2xl px-5 py-4 font-black text-sm hover:bg-white/25 active:scale-[0.98] transition-all backdrop-blur-sm"
          >
            <BookOpen size={18} className="text-white/80 shrink-0" />
            編集スタッフ 運用手順書
          </button>
        </div>

        {/* マーキュリー サービス */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-1">マーキュリー サービス</div>
          {([
            { label: 'TranChat',           sub: '社内連絡ツール', href: 'https://tranchat1.mercury-group.co.jp/chat2_fed/public/index.html' },
            { label: 'Chronus',            sub: '退勤システム',   href: 'https://chronus.mercury-group.co.jp/index.html' },
            { label: 'マーキュリーアカデミア', sub: '研修・学習',    href: 'https://www.haken-school.com/mercury-academia/top/' },
          ] as const).map(svc => (
            <a
              key={svc.label}
              href={svc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-white border border-slate-100 text-slate-800 rounded-2xl px-5 py-3.5 hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm"
            >
              <div className="min-w-0">
                <div className="font-black text-sm leading-tight">{svc.label}</div>
                <div className="text-[11px] text-slate-400 font-medium">{svc.sub}</div>
              </div>
              <ExternalLink size={14} className="text-slate-300 shrink-0 ml-3" />
            </a>
          ))}
        </div>
      </div>

      <OperationsManualModal open={showOpsManual} onClose={() => setShowOpsManual(false)} />

      {/* Event Picker Bottom Sheet — portal to escape carousel transform */}
      {createPortal(
      <AnimatePresence>
        {showEventPicker && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventPicker(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[80dvh] flex flex-col overflow-hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-9 h-1 bg-slate-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0 border-b border-slate-100">
                <div>
                  <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">準備物リスト</div>
                  <h2 className="text-base font-black text-slate-900">どのイベントに追加しますか？</h2>
                </div>
                <button
                  onClick={() => setShowEventPicker(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto px-4 pt-3 pb-10 space-y-4">
                {pickerEvents.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">進行中のイベントがありません</div>
                ) : (
                  pickerGroups.map(({ month, events: evs }) => (
                    <div key={month}>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">{month}</div>
                      <div className="flex flex-col gap-2">
                        {evs.map(ev => {
                          const s = fmtDateJP(ev.start);
                          const until = daysUntil(ev.start);
                          const isToday = until === 0;
                          const isSoon = until > 0 && until <= 7;
                          const isOngoing = until < 0 && (ev.end || ev.start) >= today;
                          const urgencyBadge = isToday
                            ? { label: '今日', cls: 'bg-red-500 text-white' }
                            : isOngoing
                            ? { label: '開催中', cls: 'bg-emerald-500 text-white' }
                            : isSoon
                            ? { label: `${until}日後`, cls: 'bg-amber-400 text-white' }
                            : null;
                          const badgeBg = isToday || isOngoing ? '#ef4444' : isSoon ? '#f59e0b' : '#6366f1';
                          return (
                            <button
                              key={ev.id}
                              onClick={() => { setShowEventPicker(false); onSelectPrepEvent(ev); }}
                              className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm flex items-stretch overflow-hidden hover:border-indigo-200 hover:shadow-md active:scale-[0.98] transition-all"
                            >
                              <div
                                className="flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0"
                                style={{ background: badgeBg }}
                              >
                                <span className="text-[10px] font-black text-white/70 leading-none">{s.month}月</span>
                                <span className="text-xl font-black text-white leading-none mt-0.5">{s.day}</span>
                                <span className="text-[10px] font-black text-white/80 leading-none mt-0.5">{s.dow}</span>
                              </div>
                              <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-bold text-slate-800 text-sm truncate">{ev.venue}</span>
                                  {urgencyBadge && (
                                    <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}>{urgencyBadge.label}</span>
                                  )}
                                </div>
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
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      , document.body)}

      {/* Permission toast — portal to escape carousel transform */}
      {createPortal(
      <AnimatePresence>
        {showPermissionToast && (
          <motion.div
            className="fixed bottom-24 inset-x-0 z-[200] flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl">
              権限がありません
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}
    </div>
  );
}
