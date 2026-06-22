import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink, X, ArrowRight } from 'lucide-react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import type { Event, PreparationItem } from '../types';
import UndeliveredModal from './UndeliveredModal';
import NoticeBoard from './NoticeBoard';
import { rs, ts, fmtDateJP, fmtDateRange } from '../lib/eventHelpers';
import { fetchTodayStaffBreakdown, fetchTodayStaffByStatus, type StaffBreakdown } from '../lib/exSchedule';
import type { StatusType } from '../lib/exScheduleConstants';
import EXBadge from './EXBadge';
import SwipeActionCard from './fx/SwipeActionCard';
import RippleButton from './fx/RippleButton';
import { EASE_OUT } from '../lib/motionTokens';

interface Props {
  events: Event[];
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (event: Event) => void;
  onSelectPrepEvent: (event: Event) => void;
  onCreateEvent: () => void;
  onOpenSchedule: () => void;
  onNavigateCalendar: () => void;
  canEditEvent: boolean;
  user: User | null;
}

function AnalogClock() {
  const hmRef = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const tick = () => {
      const fmt = formatter.format(new Date());
      if (hmRef.current) hmRef.current.textContent = fmt.slice(0, 5);
      if (secRef.current) secRef.current.textContent = fmt.slice(6, 8);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-end shrink-0 select-none">
      <div
        ref={hmRef}
        className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl font-black text-slate-900 leading-none tracking-tighter tabular-nums"
      >
        --:--
      </div>
      <div
        ref={secRef}
        className="text-xl sm:text-2xl md:text-3xl xl:text-4xl font-black text-slate-400 leading-none tracking-tighter tabular-nums mt-1 md:mt-1.5"
      >
        --
      </div>
    </div>
  );
}

function effectivePast(ev: Event, today: string): boolean {
  if (ev.status === 'cancelled') return false;
  return (ev.end || ev.start) < today;
}

function statusPill(status: string | undefined, isPast: boolean): { label: string; cls: string } | null {
  if (isPast || status === 'completed') return { label: '完了', cls: 'bg-slate-100 border border-slate-200 text-slate-600' };
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-50 border border-amber-200 text-amber-800' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-blue-50 border border-blue-200 text-blue-800' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-indigo-50 border border-indigo-200 text-indigo-800' };
    case 'cancelled':   return { label: 'キャンセル',cls: 'bg-red-50 border border-red-200 text-red-800' };
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

function EventCard({ ev, prog, today, onSelect, onSelectPrep }: {
  ev: Event;
  prog?: { total: number; done: number };
  today: string;
  onSelect: (e: Event) => void;
  onSelectPrep: (e: Event) => void;
}) {
  const past = effectivePast(ev, today);
  const st = statusPill(ev.status, past);
  const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : -1;
  const days = daysUntil(ev.start, today);
  const regionColor = rs(ev.region || '').dot;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(8,47,73,0.10)' }}
      className="w-full rounded-2xl transition-all group overflow-hidden shadow-sm hover:shadow-md flex items-stretch"
      style={{
        background: 'rgba(255,255,255,0.82)',
        border: '1px solid rgba(103,232,249,0.28)',
        boxShadow: '0 1px 0 rgba(103,232,249,0.35) inset, 0 1px 3px rgba(8,47,73,0.06)',
      }}
    >
      <div className="w-1 shrink-0" style={{ background: regionColor }} />
      <button
        type="button"
        onClick={() => onSelect(ev)}
        className="flex-1 min-w-0 p-4 text-left touch-manipulation active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-base font-black text-slate-900 truncate">{ev.venue}</span>
              {st && (
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${st.cls}`}>{st.label}</span>
              )}
              {!past && days === 0 && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500 text-white">今日</span>
              )}
              {!past && days > 0 && days <= 3 && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/80 text-white">{days}日後</span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {ev.type || ''}
            </div>
            {pct >= 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-indigo-400' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">{prog!.done}/{prog!.total}</span>
              </div>
            )}
          </div>
          <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-600 shrink-0 mt-1 transition-colors" />
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelectPrep(ev); }}
        className="shrink-0 w-[52px] sm:w-14 border-l border-slate-100 flex flex-col items-center justify-center gap-0.5 px-1 text-[9px] sm:text-[10px] font-black text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors touch-manipulation leading-tight text-center"
        aria-label={`${ev.venue}の準備物リストを開く`}
      >
        <span>準備物</span>
        <span>リスト</span>
      </button>
    </motion.div>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl py-5 text-center text-sm text-slate-400 shadow-sm">
      {label}
    </div>
  );
}

export default function HomeView({ events, prepProgressMap, onSelectEvent, onSelectPrepEvent, onCreateEvent, onOpenSchedule, onNavigateCalendar, canEditEvent, user }: Props) {
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showPermissionToast, setShowPermissionToast] = useState(false);
  const [showUndelivered, setShowUndelivered] = useState(false);
  const [showNextPicker, setShowNextPicker] = useState(false);
  const [staffBreakdown, setStaffBreakdown] = useState<StaffBreakdown | null>(null);
  const [staffByStatus, setStaffByStatus] = useState<Record<StatusType, string[]> | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!showPermissionToast) return;
    const t = setTimeout(() => setShowPermissionToast(false), 2500);
    return () => clearTimeout(t);
  }, [showPermissionToast]);

  useEffect(() => {
    setStaffLoading(true);
    Promise.all([fetchTodayStaffBreakdown(), fetchTodayStaffByStatus()])
      .then(([bd, byStatus]) => {
        setStaffBreakdown(bd);
        setStaffByStatus(byStatus);
      })
      .finally(() => setStaffLoading(false));
  }, [today]);

  // 長南着で到着予定日を過ぎた準備物を自動完了
  useEffect(() => {
    const activeEvents = events.filter(e => e.status !== 'cancelled' && e.status !== 'completed');
    if (!activeEvents.length) return;
    let cancelled = false;
    const autoComplete = async () => {
      const toComplete: { eventId: string; itemId: string }[] = [];
      const snapshots = await Promise.all(
        activeEvents.map(ev =>
          getDocs(collection(db, `events/${ev.id}/preparationItems`)).then(snap => ({ eventId: ev.id, snap }))
        )
      );
      for (const { eventId, snap } of snapshots) {
        snap.docs.forEach(d => {
          const data = d.data() as PreparationItem;
          if (data.name?.trim() && data.arrivalDestination === '長南' &&
              data.arrivalDate && data.arrivalDate <= today && data.orderStatus !== 'completed') {
            toComplete.push({ eventId, itemId: d.id });
          }
        });
      }
      if (!toComplete.length || cancelled) return;
      const batch = writeBatch(db);
      toComplete.forEach(({ eventId, itemId }) => {
        batch.update(doc(db, `events/${eventId}/preparationItems/${itemId}`), { orderStatus: 'completed' });
      });
      await batch.commit();
    };
    autoComplete().catch(console.error);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.map(e => e.id).join(','), today]);

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
    const thisMonth = events.filter(e => e.status !== 'cancelled' && e.start?.startsWith(today.slice(0, 7)));
    const nextEvent = events
      .filter(e => e.status !== 'cancelled' && e.start >= today)
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    const daysToNext = nextEvent
      ? Math.ceil((new Date(nextEvent.start + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
      : null;
    return { thisMonthCount: thisMonth.length, daysToNext, nextVenue: nextEvent?.venue ?? null };
  }, [events, today]);

  // 次回イベント（同日複数対応）— 最も近い開催日の全イベント
  const nextEvents = useMemo(() => {
    const upcoming = events
      .filter(e => e.status !== 'cancelled' && e.start >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (upcoming.length === 0) return [];
    const nearestDate = upcoming[0].start;
    return upcoming.filter(e => e.start === nearestDate);
  }, [events, today]);

  const handleOpenNext = () => {
    if (nextEvents.length === 0) return;
    if (nextEvents.length === 1) onSelectEvent(nextEvents[0]);
    else setShowNextPicker(true);
  };

  const sectionAnim = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: EASE_OUT, delay: i * 0.06 },
  });

  return (
    <div>

      <div className="relative z-10 flex flex-col gap-5 px-4 md:px-6 lg:px-8 pt-6 pb-32 md:pb-8 w-full max-w-none">

        {/* Date header — モバイル: 日付/時計+EXロゴ(右) / PC: 日付(左)・EXロゴ(中央)・時計(右) */}
        <motion.div {...sectionAnim(0)} className="flex items-center gap-3 text-slate-900">
          <div className="flex-1 flex items-end gap-2 min-w-0">
            <div className="text-6xl sm:text-7xl md:text-8xl font-black leading-none tracking-tighter tabular-nums">
              {new Date().getDate()}
            </div>
            <div className="pb-1 flex flex-col gap-0.5 min-w-0">
              <div className="text-sm sm:text-xl font-black text-slate-800 leading-tight">
                {new Date().toLocaleDateString('ja-JP', { month: 'long' })}
              </div>
              <div className="text-xs font-bold text-slate-500 leading-tight">
                {new Date().toLocaleDateString('ja-JP', { weekday: 'long' })}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-400">{new Date().getFullYear()}</div>
            </div>
          </div>

          {/* PC: EXロゴを中央に配置 */}
          <div className="hidden md:flex md:flex-1 justify-center">
            <EXBadge size={104} />
          </div>

          {/* 右: 時計 + モバイル用EXロゴ */}
          <div className="flex items-center gap-3 shrink-0 md:flex-1 md:justify-end">
            <div className="hidden min-[400px]:block">
              <AnalogClock />
            </div>
            <div className="sm:hidden"><EXBadge size={64} /></div>
            <div className="hidden sm:block md:hidden"><EXBadge size={80} /></div>
          </div>
        </motion.div>

        {/* Stats — 今月 / 本日稼働 / 次イベント を横並び */}
        <motion.div {...sectionAnim(1)} className="grid grid-cols-3 gap-2">
          <button
            onClick={onNavigateCalendar}
            className="tank-card rounded-2xl p-3 flex flex-col text-left hover:brightness-[1.03] transition-all"
          >
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">今月</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 leading-none">{stats.thisMonthCount}</span>
              <span className="text-xs font-bold text-slate-500">件</span>
            </div>
            <span className="mt-auto pt-2 flex items-center gap-0.5 text-[10px] font-black text-indigo-600">
              詳しく <ArrowRight size={10} />
            </span>
          </button>

          <button
            onClick={onOpenSchedule}
            className="tank-card rounded-2xl p-3 flex flex-col text-left hover:brightness-[1.03] transition-all"
          >
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">本日稼働</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 leading-none">
                {staffLoading ? '…' : staffBreakdown !== null ? staffBreakdown.total : '—'}
              </span>
              {!staffLoading && staffBreakdown !== null && (
                <span className="text-xs font-bold text-slate-500">人</span>
              )}
            </div>
            <span className="mt-auto pt-2 flex items-center gap-0.5 text-[10px] font-black text-indigo-600">
              スケジュールを表示 <ArrowRight size={10} />
            </span>
          </button>

          <button
            onClick={handleOpenNext}
            disabled={nextEvents.length === 0}
            className="tank-card rounded-2xl p-3 flex flex-col text-left hover:brightness-[1.03] transition-all disabled:cursor-default"
          >
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">次イベント</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 leading-none">
                {stats.daysToNext === null ? '—' : stats.daysToNext === 0 ? '今日' : stats.daysToNext}
              </span>
              {stats.daysToNext !== null && stats.daysToNext > 0 && (
                <span className="text-xs font-bold text-slate-500">日後</span>
              )}
            </div>
            <span className="mt-auto pt-2 flex items-center gap-0.5 text-[10px] font-bold text-slate-400 truncate">
              {nextEvents.length > 1
                ? <span className="font-black text-indigo-600">{nextEvents.length}件を見る</span>
                : (stats.nextVenue || '予定なし')}
            </span>
          </button>
        </motion.div>

        {/* 稼働内訳 — 本社/イベント/外出/公休/希望休/その他 を横並び（PCはホバーで氏名表示） */}
        {!staffLoading && staffBreakdown !== null && (
          <motion.div {...sectionAnim(2)} className="tank-card rounded-2xl p-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-1">
              {([
                { label: '本社',   value: staffBreakdown.office,   statuses: ['office'],              bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800' },
                { label: 'イベント', value: staffBreakdown.event,    statuses: ['event'],               bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
                { label: '外出',   value: staffBreakdown.dispatch, statuses: ['dispatch', 'standby'], bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
                { label: '公休',   value: staffBreakdown.rest,     statuses: ['rest', 'normal'],      bg: 'bg-violet-50 border-violet-200', text: 'text-violet-800' },
                { label: '希望休', value: staffBreakdown.request,  statuses: ['request'],             bg: 'bg-pink-50 border-pink-200',   text: 'text-pink-800' },
                { label: 'その他', value: staffBreakdown.other,    statuses: ['other', 'training', 'carry', 'absence'], bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
              ] as { label: string; value: number; statuses: StatusType[]; bg: string; text: string }[]).map(({ label, value, statuses, bg, text }) => {
                const names = staffByStatus
                  ? statuses.flatMap(s => staffByStatus[s] ?? []).map(n => n.replace('　', ' '))
                  : [];
                return (
                  <div key={label} className={`group relative text-center rounded-lg py-1.5 border ${bg}`}>
                    <div className={`font-black leading-none text-lg ${text}`}>{value}</div>
                    <div className="text-[9px] text-slate-600 mt-0.5 font-bold">{label}</div>
                    {names.length > 0 && (
                      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 hidden md:group-hover:block w-max max-w-[220px]">
                        <div className="bg-slate-900 text-white text-[11px] font-medium rounded-xl px-3 py-2 shadow-xl text-left">
                          <div className="font-black mb-1 text-[10px] uppercase tracking-widest text-slate-300">{label}（{names.length}名）</div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {names.map((n, i) => <span key={i}>{n}</span>)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
        {!staffLoading && staffBreakdown === null && (
          <div className="tank-card rounded-2xl p-3 text-[10px] text-slate-400">
            稼働データを取得できませんでした
          </div>
        )}

        {/* 連絡事項（掲示板）— 本日のイベント・来週のイベントの上部 */}
        <motion.div {...sectionAnim(2.5)}>
          <NoticeBoard canEdit={canEditEvent} user={user} />
        </motion.div>

        <motion.div {...sectionAnim(3)} className="md:grid md:grid-cols-2 md:gap-6 xl:gap-8">
        {/* 本日のイベント */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-4 bg-slate-300 rounded-full shrink-0" />
            <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">本日のイベント</div>
            {todayEvents.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black text-white">{todayEvents.length}</span>
            )}
          </div>
          {todayEvents.length === 0
            ? <SectionEmpty label="本日のイベントはありません" />
            : <div className="flex flex-col gap-2">
                {todayEvents.map(ev => (
                  <EventCard key={ev.id} ev={ev} prog={prepProgressMap[ev.id]} today={today} onSelect={onSelectEvent} onSelectPrep={onSelectPrepEvent} />
                ))}
              </div>
          }
        </div>

        {/* 来週のイベント */}
        <div className="mt-5 md:mt-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-4 bg-slate-300 rounded-full shrink-0" />
            <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">来週のイベント</div>
          </div>
          {upcomingWeek.length === 0
            ? <SectionEmpty label="来週のイベントはありません" />
            : <div className="flex flex-col gap-2">
                {upcomingWeek.map(ev => (
                  <EventCard key={ev.id} ev={ev} prog={prepProgressMap[ev.id]} today={today} onSelect={onSelectEvent} onSelectPrep={onSelectPrepEvent} />
                ))}
              </div>
          }
        </div>
        </motion.div>

        <motion.div {...sectionAnim(4)} className="md:grid md:grid-cols-2 md:gap-6 xl:gap-8">
        {/* クイックアクション */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1">クイックアクション</div>

          <RippleButton
            onClick={() => setShowUndelivered(true)}
            className="flex items-center gap-3 tank-card text-slate-900 rounded-2xl px-5 py-3.5 font-black text-sm hover:brightness-[1.03] active:scale-[0.98] transition-all w-full"
          >
            未着一覧
          </RippleButton>

          <RippleButton
            onClick={() => { if (canEditEvent) { onCreateEvent(); } else { setShowPermissionToast(true); } }}
            className="flex items-center gap-3 tank-card text-slate-900 rounded-2xl px-5 py-3.5 font-black text-sm hover:brightness-[1.03] active:scale-[0.98] transition-all w-full"
          >
            新規イベントを追加する
          </RippleButton>

          <RippleButton
            onClick={onOpenSchedule}
            className="flex items-center gap-3 tank-card text-slate-900 rounded-2xl px-5 py-3.5 font-black text-sm hover:brightness-[1.03] active:scale-[0.98] transition-all w-full"
          >
            スケジュール
          </RippleButton>

        </div>

        {/* マーキュリー サービス */}
        <div className="mt-2 flex flex-col gap-2">
          <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1">マーキュリー サービス</div>
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
              className="flex items-center justify-between tank-card text-slate-900 rounded-2xl px-5 py-3.5 hover:brightness-[1.03] active:scale-[0.98] transition-all"
            >
              <div className="min-w-0">
                <div className="font-black text-sm leading-tight">{svc.label}</div>
                <div className="text-[11px] text-slate-500 font-medium">{svc.sub}</div>
              </div>
              <ExternalLink size={14} className="text-slate-400 shrink-0 ml-3" />
            </a>
          ))}
        </div>
        </motion.div>
      </div>

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
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[80dvh] flex flex-col overflow-hidden border-t border-slate-200 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-9 h-1 bg-slate-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0 border-b border-slate-200">
                <div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">準備物リスト</div>
                  <h2 className="text-base font-black text-slate-900">どのイベントに追加しますか？</h2>
                </div>
                <button
                  onClick={() => setShowEventPicker(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
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
                      <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1 mb-2">{month}</div>
                      <div className="flex flex-col gap-2">
                        {evs.map(ev => {
                          const s = fmtDateJP(ev.start);
                          const until = daysUntil(ev.start, today);
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
                              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm flex items-stretch overflow-hidden hover:bg-slate-50 active:scale-[0.98] transition-all"
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
                                  <span className="font-bold text-slate-900 text-sm truncate">{ev.venue}</span>
                                  {urgencyBadge && (
                                    <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}>{urgencyBadge.label}</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 truncate">{fmtDateRange(ev.start, ev.end)}</div>
                              </div>
                              <div className="flex items-center pr-3">
                                <ChevronRight size={16} className="text-slate-400 shrink-0" />
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

      {showUndelivered && (
        <UndeliveredModal events={events} onClose={() => setShowUndelivered(false)} />
      )}

      {/* 次回イベント選択（同日複数件） — portal */}
      {createPortal(
      <AnimatePresence>
        {showNextPicker && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNextPicker(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[80dvh] flex flex-col overflow-hidden border-t border-slate-200 shadow-2xl md:inset-0 md:m-auto md:h-fit md:max-h-[80vh] md:w-[min(520px,92vw)] md:rounded-3xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b border-slate-100">
                <div>
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">次回イベント</div>
                  <h2 className="text-base font-black text-slate-900">どのイベントを開きますか？</h2>
                </div>
                <button
                  onClick={() => setShowNextPicker(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-3 flex-1 space-y-2">
                {nextEvents.map(ev => {
                  const regionColor = rs(ev.region || '').dot;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => { setShowNextPicker(false); onSelectEvent(ev); }}
                      className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm flex items-stretch overflow-hidden hover:bg-slate-50 active:scale-[0.99] transition-all group"
                    >
                      <div className="w-1 shrink-0" style={{ background: regionColor }} />
                      <div className="flex-1 min-w-0 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 truncate flex-1">{ev.venue || ev.type}</span>
                          <ChevronRight size={15} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {fmtDateRange(ev.start, ev.end)}{ev.client ? ` · ${ev.client}` : ''}{ev.region ? ` · ${ev.region}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
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
            <div className="bg-white border border-slate-200 text-slate-900 text-sm font-bold px-5 py-3 rounded-2xl shadow-xl">
              権限がありません
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}
    </div>
  );
}
