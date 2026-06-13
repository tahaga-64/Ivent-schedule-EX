import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ExternalLink, X,
  ClipboardList, Plus, CalendarDays,
} from 'lucide-react';
import type { Event } from '../types';
import { rs, fmtDateJP, fmtDateRange } from '../lib/eventHelpers';
import { fetchTodayStaffBreakdown, type StaffBreakdown } from '../lib/exSchedule';
import { useFxLevel } from '../lib/deviceTier';
import EXBadge from './EXBadge';
import SwipeActionCard from './fx/SwipeActionCard';
import RippleButton from './fx/RippleButton';
import CountUp from './fx/CountUp';
import Skeleton from './fx/Skeleton';
import ScrollAquaBackdrop from './fx/ScrollAquaBackdrop';
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
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function effectivePast(ev: Event, today: string): boolean {
  if (ev.status === 'cancelled') return false;
  return (ev.end || ev.start) < today;
}

function statusPill(
  status: string | undefined,
  isPast: boolean,
): { label: string; cls: string } | null {
  if (isPast || status === 'completed')
    return { label: '完了', cls: 'bg-slate-100 border border-slate-200 text-slate-600' };
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-50 border border-amber-200 text-amber-800' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-blue-50 border border-blue-200 text-blue-800' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-emerald-50 border border-emerald-200 text-emerald-800' };
    case 'cancelled':   return { label: 'キャンセル',cls: 'bg-red-50 border border-red-200 text-red-800' };
    default:            return null;
  }
}

function fmtRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()];
    return `${dt.getMonth() + 1}/${dt.getDate()}(${dow})`;
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
  return Math.ceil(
    (new Date(start + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) /
      86400000,
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({
  ev,
  prog,
  today,
}: {
  ev: Event;
  prog?: { total: number; done: number };
  today: string;
}) {
  const past = effectivePast(ev, today);
  const st = statusPill(ev.status, past);
  const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : -1;
  const days = daysUntil(ev.start, today);
  const regionColor = rs(ev.region || '').dot;

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 10px 28px rgba(8,47,73,0.12)' }}
      className="w-full text-left rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(103,232,249,0.28)',
        boxShadow: '0 1px 0 rgba(103,232,249,0.35) inset, 0 1px 3px rgba(8,47,73,0.06)',
      }}
    >
      <div className="flex items-stretch">
        {/* 地域カラーバー */}
        <div className="w-1 shrink-0" style={{ background: regionColor }} />

        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">

              {/* 名称 + ステータス + 緊急バッジ */}
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-base font-bold text-slate-900 truncate">{ev.venue}</span>
                {st && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                )}
                {!past && days === 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    今日
                  </span>
                )}
                {!past && days === 1 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-400 text-white">
                    明日
                  </span>
                )}
                {!past && days > 1 && days <= 3 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {days}日後
                  </span>
                )}
              </div>

              {/* 日付（常時表示） */}
              <div className="text-xs font-medium text-slate-500 mb-0.5">
                {fmtRange(ev.start, ev.end || ev.start)}
              </div>

              {/* イベント種別 */}
              {ev.type && (
                <div className="text-xs font-medium text-slate-400">{ev.type}</div>
              )}

              {/* 準備進捗バー */}
              {pct >= 0 && (
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        pct === 100
                          ? 'bg-emerald-400'
                          : pct >= 70
                          ? 'bg-indigo-400'
                          : 'bg-amber-400'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {prog!.done}/{prog!.total}
                  </span>
                </div>
              )}
            </div>

            <ChevronRight
              size={16}
              className="text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5 transition-colors"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── SectionEmpty ─────────────────────────────────────────────────────────────

function SectionEmpty({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="rounded-2xl py-7 px-4 text-center select-none"
      style={{
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(103,232,249,0.2)',
      }}
    >
      <div className="text-2xl mb-2" aria-hidden="true">🐟</div>
      <div className="text-sm font-medium text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-300 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div
        className="w-0.5 h-4 rounded-full shrink-0"
        style={{ background: 'rgba(14,116,144,0.5)' }}
      />
      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</div>
      {count !== undefined && count > 0 && (
        <span className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── HomeView ─────────────────────────────────────────────────────────────────

export default function HomeView({
  events,
  prepProgressMap,
  onSelectEvent,
  onSelectPrepEvent,
  onCreateEvent,
  onOpenSchedule,
  onNavigateCalendar,
  canEditEvent,
  scrollContainerRef,
}: Props) {
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showPermissionToast, setShowPermissionToast] = useState(false);
  const [staffBreakdown, setStaffBreakdown] = useState<StaffBreakdown | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const fxLevel = useFxLevel();
  const showBg = fxLevel !== 'off' && !!scrollContainerRef;

  // BottomSheet drag-to-close
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);

  function handleHandlePointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
    dragStartTime.current = Date.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleHandlePointerMove(e: React.PointerEvent) {
    const dy = e.clientY - dragStartY.current;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  }
  function handleHandlePointerUp(e: React.PointerEvent) {
    const dy = e.clientY - dragStartY.current;
    const dt = Date.now() - dragStartTime.current;
    const velocity = dt > 0 ? (dy / dt) * 1000 : 0;
    if (dy > 80 || velocity > 400) {
      setShowEventPicker(false);
    } else if (sheetRef.current) {
      sheetRef.current.style.transition =
        'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
      sheetRef.current.style.transform = '';
      setTimeout(() => {
        if (sheetRef.current) sheetRef.current.style.transition = '';
      }, 320);
    }
  }

  useEffect(() => {
    if (!showPermissionToast) return;
    const t = setTimeout(() => setShowPermissionToast(false), 2500);
    return () => clearTimeout(t);
  }, [showPermissionToast]);

  useEffect(() => {
    setStaffLoading(true);
    fetchTodayStaffBreakdown()
      .then(bd => setStaffBreakdown(bd))
      .finally(() => setStaffLoading(false));
  }, [today]);

  const in7 = addDays(today, 7);

  const { todayEvents, upcomingWeek } = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled');
    const todayEvents = active
      .filter(e => e.start && e.start <= today && today <= (e.end || e.start))
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const upcomingWeek = active
      .filter(e => e.start && e.start > today && e.start <= in7)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    return { todayEvents, upcomingWeek };
  }, [events, today, in7]);

  const pickerEvents = useMemo(
    () =>
      events
        .filter(ev => ev.status !== 'cancelled' && (ev.end || ev.start) >= today)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [events, today],
  );

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
    const thisMonth = events.filter(
      e => e.status !== 'cancelled' && e.start?.startsWith(today.slice(0, 7)),
    );
    const nextEvent = events
      .filter(e => e.status !== 'cancelled' && e.start >= today)
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
    const daysToNext = nextEvent
      ? Math.ceil(
          (new Date(nextEvent.start + 'T00:00:00').getTime() -
            new Date(today + 'T00:00:00').getTime()) /
            86400000,
        )
      : null;
    return {
      thisMonthCount: thisMonth.length,
      daysToNext,
      nextVenue: nextEvent?.venue ?? null,
      nextEvent,
    };
  }, [events, today]);

  const sa = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, ease: EASE_OUT, delay: i * 0.05 },
  });

  const now = new Date();

  return (
    <div>
      {/* 海中バックドロップ（ambient、コンテンツを塞がない） */}
      {showBg && scrollContainerRef && (
        <ScrollAquaBackdrop containerRef={scrollContainerRef} />
      )}

      <div className="relative z-10 flex flex-col gap-5 px-4 md:px-6 lg:px-8 pt-5 pb-28 md:pb-10 w-full max-w-none">

        {/* ① DateHero — コンパクト、常時表示 */}
        <motion.div {...sa(0)}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2.5">
                <div className="text-5xl sm:text-6xl font-black text-slate-900 leading-none tracking-tight tabular-nums">
                  {now.getDate()}
                </div>
                <div className="pb-1 flex flex-col gap-0.5">
                  <div className="text-base font-bold text-slate-700 leading-tight">
                    {now.toLocaleDateString('ja-JP', { month: 'long' })}
                  </div>
                  <div className="text-xs font-medium text-slate-400 leading-tight">
                    {now.toLocaleDateString('ja-JP', { weekday: 'long' })}&nbsp;&nbsp;{now.getFullYear()}
                  </div>
                </div>
              </div>

              {/* 次イベント callout（7日以内の場合のみ） */}
              {stats.nextEvent && stats.daysToNext !== null && stats.daysToNext <= 7 && (
                <button
                  onClick={() => stats.nextEvent && onSelectEvent(stats.nextEvent)}
                  className="mt-3 flex items-center gap-1.5 group"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      stats.daysToNext === 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-800 transition-colors leading-snug">
                    {stats.nextVenue}
                    <span
                      className={`ml-1.5 font-bold ${
                        stats.daysToNext === 0 ? 'text-rose-500' : 'text-amber-500'
                      }`}
                    >
                      {stats.daysToNext === 0 ? '今日開催' : `あと${stats.daysToNext}日`}
                    </span>
                  </span>
                  <ChevronRight
                    size={12}
                    className="text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors"
                  />
                </button>
              )}
            </div>

            <EXBadge size={56} />
          </div>
        </motion.div>

        {/* ② 本日のイベント */}
        <motion.div {...sa(1)}>
          <SectionHeader label="本日のイベント" count={todayEvents.length} />
          {todayEvents.length === 0 ? (
            <SectionEmpty
              label="本日のイベントはありません"
              sub="次のイベントに備えて準備を進めましょう"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {todayEvents.map(ev => (
                <SwipeActionCard
                  key={ev.id}
                  onAction={() => onSelectPrepEvent(ev)}
                  onTap={() => onSelectEvent(ev)}
                >
                  <EventCard ev={ev} prog={prepProgressMap[ev.id]} today={today} />
                </SwipeActionCard>
              ))}
            </div>
          )}
        </motion.div>

        {/* ③ PRIMARY CTA */}
        <motion.div {...sa(2)}>
          <RippleButton
            onClick={() => setShowEventPicker(true)}
            className="flex items-center justify-center gap-3 w-full rounded-2xl px-5 py-4 font-black text-base text-white shadow-md active:scale-[0.98] transition-all"
            style={{
              background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)',
            }}
          >
            <ClipboardList size={19} />
            準備物リストを開く
          </RippleButton>
        </motion.div>

        {/* ④ Stats Row — 全カードにCTA */}
        <motion.div {...sa(3)} className="grid grid-cols-3 gap-2">

          {/* 今月 */}
          <button
            onClick={onNavigateCalendar}
            className="tank-card rounded-2xl p-3 flex flex-col text-left hover:brightness-[1.03] active:scale-[0.98] transition-all group"
          >
            <div className="text-[11px] font-bold text-slate-500 mb-1.5">今月</div>
            <div className="flex items-baseline gap-1">
              <CountUp value={stats.thisMonthCount} className="text-3xl font-black text-slate-900 leading-none" />
              <span className="text-xs font-medium text-slate-500">件</span>
            </div>
            <span className="mt-auto pt-2 flex items-center gap-0.5 text-[11px] font-bold text-cyan-600 group-hover:text-cyan-500 transition-colors">
              カレンダー <ChevronRight size={11} />
            </span>
          </button>

          {/* 本日稼働 */}
          <button
            onClick={() => setBreakdownOpen(v => !v)}
            className="tank-card rounded-2xl p-3 flex flex-col text-left hover:brightness-[1.03] active:scale-[0.98] transition-all group"
          >
            <div className="text-[11px] font-bold text-slate-500 mb-1.5">本日稼働</div>
            <div className="flex items-baseline gap-1">
              {staffLoading ? (
                <Skeleton className="h-8 w-10 mt-0.5" />
              ) : staffBreakdown !== null ? (
                <>
                  <CountUp value={staffBreakdown.total} className="text-3xl font-black text-slate-900 leading-none" />
                  <span className="text-xs font-medium text-slate-500">人</span>
                </>
              ) : (
                <span className="text-3xl font-black text-slate-400">—</span>
              )}
            </div>
            <span className="mt-auto pt-2 flex items-center gap-0.5 text-[11px] font-bold text-cyan-600 group-hover:text-cyan-500 transition-colors">
              内訳
              <ChevronRight
                size={11}
                className={`transition-transform duration-200 ${breakdownOpen ? 'rotate-90' : ''}`}
              />
            </span>
          </button>

          {/* 次イベント */}
          <button
            onClick={() => { if (stats.nextEvent) onSelectEvent(stats.nextEvent); }}
            disabled={!stats.nextEvent}
            className="tank-card rounded-2xl p-3 flex flex-col text-left hover:brightness-[1.03] active:scale-[0.98] transition-all disabled:pointer-events-none group"
          >
            <div className="text-[11px] font-bold text-slate-500 mb-1.5">次イベント</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 leading-none tabular-nums">
                {stats.daysToNext === null ? '—' : stats.daysToNext === 0 ? '今日' : stats.daysToNext}
              </span>
              {stats.daysToNext !== null && stats.daysToNext > 0 && (
                <span className="text-xs font-medium text-slate-500">日後</span>
              )}
            </div>
            <span className="mt-auto pt-2 text-[11px] font-medium text-slate-400 truncate group-hover:text-slate-600 transition-colors">
              {stats.nextVenue || '予定なし'}
            </span>
          </button>
        </motion.div>

        {/* 稼働内訳（展開式） */}
        <AnimatePresence>
          {breakdownOpen && (
            <motion.div
              key="breakdown"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="tank-card rounded-2xl p-3">
                {staffLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-12" rounded="rounded-lg" />
                    ))}
                  </div>
                ) : staffBreakdown !== null ? (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-1">
                    {(
                      [
                        { label: '本社',    value: staffBreakdown.office,   bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-800' },
                        { label: 'イベント', value: staffBreakdown.event,    bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
                        { label: '外出',    value: staffBreakdown.dispatch, bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-800' },
                        { label: '公休',    value: staffBreakdown.rest,     bg: 'bg-violet-50 border-violet-200', text: 'text-violet-800' },
                        { label: '希望休',  value: staffBreakdown.request,  bg: 'bg-pink-50 border-pink-200',    text: 'text-pink-800' },
                        { label: 'その他',  value: staffBreakdown.other,    bg: 'bg-slate-50 border-slate-200',  text: 'text-slate-700' },
                      ] as const
                    ).map(({ label, value, bg, text }) => (
                      <div key={label} className={`text-center rounded-lg py-1.5 border ${bg}`}>
                        <CountUp value={value} className={`block font-black leading-none text-lg ${text}`} />
                        <div className="text-[11px] text-slate-600 mt-0.5 font-medium">{label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-3">
                    データを取得できませんでした
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ⑤ 直近7日のイベント */}
        <motion.div {...sa(4)}>
          <SectionHeader label="直近7日のイベント" />
          {upcomingWeek.length === 0 ? (
            <SectionEmpty label="直近7日のイベントはありません" />
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingWeek.map(ev => (
                <SwipeActionCard
                  key={ev.id}
                  onAction={() => onSelectPrepEvent(ev)}
                  onTap={() => onSelectEvent(ev)}
                >
                  <EventCard ev={ev} prog={prepProgressMap[ev.id]} today={today} />
                </SwipeActionCard>
              ))}
            </div>
          )}
        </motion.div>

        {/* ⑥ クイックリンク */}
        <motion.div {...sa(5)} className="md:grid md:grid-cols-2 md:gap-6 xl:gap-8">

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-bold text-slate-500 mb-0.5">クイックアクション</div>

            {/* Secondary */}
            <RippleButton
              onClick={() => {
                if (canEditEvent) onCreateEvent();
                else setShowPermissionToast(true);
              }}
              className="flex items-center gap-3 tank-card text-slate-700 rounded-2xl px-5 py-3.5 font-bold text-sm hover:brightness-[1.03] active:scale-[0.98] transition-all w-full"
            >
              <Plus size={16} className="text-slate-400 shrink-0" />
              新規イベントを追加する
            </RippleButton>

            {/* Tertiary */}
            <RippleButton
              onClick={onOpenSchedule}
              className="flex items-center gap-3 text-slate-500 rounded-xl px-5 py-3 font-medium text-sm hover:bg-white/60 active:scale-[0.98] transition-all w-full"
            >
              <CalendarDays size={15} className="text-slate-400 shrink-0" />
              スケジュール確認
            </RippleButton>
          </div>

          {/* マーキュリーサービス */}
          <div className="mt-4 md:mt-0 flex flex-col gap-2">
            <div className="text-[11px] font-bold text-slate-500 mb-0.5">マーキュリーサービス</div>
            {(
              [
                { label: 'TranChat',            sub: '社内連絡ツール', href: 'https://tranchat1.mercury-group.co.jp/chat2_fed/public/index.html' },
                { label: 'Chronus',             sub: '退勤システム',   href: 'https://chronus.mercury-group.co.jp/index.html' },
                { label: 'マーキュリーアカデミア', sub: '研修・学習',    href: 'https://www.haken-school.com/mercury-academia/top/' },
              ] as const
            ).map(svc => (
              <a
                key={svc.label}
                href={svc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between tank-card text-slate-900 rounded-2xl px-5 py-3.5 hover:brightness-[1.03] active:scale-[0.98] transition-all"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-800 leading-tight">{svc.label}</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">{svc.sub}</div>
                </div>
                <ExternalLink size={14} className="text-slate-400 shrink-0 ml-3" />
              </a>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Event Picker Bottom Sheet */}
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
                ref={sheetRef}
                className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[82dvh] flex flex-col overflow-hidden border-t border-slate-100 shadow-2xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* ドラッグハンドル（下スワイプで閉じる） */}
                <div
                  className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                  onPointerDown={handleHandlePointerDown}
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={handleHandlePointerUp}
                >
                  <div className="w-10 h-1 bg-slate-200 rounded-full" />
                </div>

                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0 border-b border-slate-100">
                  <div>
                    <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-0.5">
                      準備物リスト
                    </div>
                    <h2 className="text-base font-black text-slate-900">どのイベントを開きますか？</h2>
                  </div>
                  <button
                    onClick={() => setShowEventPicker(false)}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                    aria-label="閉じる"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* コンテンツ */}
                <div
                  ref={contentScrollRef}
                  className="overflow-y-auto px-4 pt-3 pb-12 space-y-4"
                >
                  {pickerEvents.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="text-3xl mb-3" aria-hidden="true">🐟</div>
                      <div className="text-sm font-medium text-slate-400">進行中のイベントがありません</div>
                    </div>
                  ) : (
                    pickerGroups.map(({ month, events: evs }) => (
                      <div key={month}>
                        <div className="text-xs font-bold text-slate-500 px-1 mb-2">{month}</div>
                        <div className="flex flex-col gap-2">
                          {evs.map(ev => {
                            const s = fmtDateJP(ev.start);
                            const until = daysUntil(ev.start, today);
                            const isToday = until === 0;
                            const isSoon = until > 0 && until <= 7;
                            const isOngoing = until < 0 && (ev.end || ev.start) >= today;
                            const urgencyBadge = isToday
                              ? { label: '今日', cls: 'bg-rose-500 text-white' }
                              : isOngoing
                              ? { label: '開催中', cls: 'bg-emerald-500 text-white' }
                              : isSoon
                              ? { label: `${until}日後`, cls: 'bg-amber-400 text-white' }
                              : null;
                            const badgeBg =
                              isToday || isOngoing ? '#ef4444' : isSoon ? '#f59e0b' : '#6366f1';
                            return (
                              <button
                                key={ev.id}
                                onClick={() => {
                                  setShowEventPicker(false);
                                  onSelectPrepEvent(ev);
                                }}
                                className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm flex items-stretch overflow-hidden hover:bg-slate-50 active:scale-[0.98] transition-all"
                              >
                                <div
                                  className="flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0"
                                  style={{ background: badgeBg }}
                                >
                                  <span className="text-[10px] font-bold text-white/70 leading-none">
                                    {s.month}月
                                  </span>
                                  <span className="text-xl font-black text-white leading-none mt-0.5">
                                    {s.day}
                                  </span>
                                  <span className="text-[10px] font-bold text-white/80 leading-none mt-0.5">
                                    {s.dow}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-slate-900 text-sm truncate">
                                      {ev.venue}
                                    </span>
                                    {urgencyBadge && (
                                      <span
                                        className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}
                                      >
                                        {urgencyBadge.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {fmtDateRange(ev.start, ev.end)}
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
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Permission toast */}
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
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
