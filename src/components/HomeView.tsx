import { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ExternalLink, X, ClipboardList, Plus,
  CalendarDays, ChevronDown,
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
import { EASE_OUT } from '../lib/motionTokens';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HomeFishScene  = lazy(() => import('./webgl/HomeFishScene'));

// ─── Props ────────────────────────────────────────────────────────────────────

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
    return { label: '完了', cls: 'bg-white/10 border border-white/15 text-white/40' };
  switch (status) {
    case 'in_progress': return { label: '準備中',   cls: 'bg-amber-500/20 border border-amber-400/30 text-amber-300' };
    case 'waiting':     return { label: '入荷待ち', cls: 'bg-sky-500/20 border border-sky-400/30 text-sky-300' };
    case 'ready':       return { label: '準備完了', cls: 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300' };
    case 'cancelled':   return { label: 'キャンセル', cls: 'bg-red-500/20 border border-red-400/30 text-red-300' };
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
    (new Date(start + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000,
  );
}

// ─── LiveClock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return (
    <div className="select-none text-center tabular-nums">
      <div
        className="text-[4.5rem] sm:text-[6rem] font-black text-white leading-none tracking-tighter"
        style={{ textShadow: '0 0 40px rgba(34,200,216,0.55), 0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {hh}<span className="text-white/35 animate-pulse">:</span>{mm}
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-white/30 mt-2 tracking-[0.35em]">
        {ss}
      </div>
    </div>
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
      whileHover={{ y: -2, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}
      className="w-full text-left rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: 'rgba(0,12,28,0.52)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset',
      }}
    >
      <div className="flex items-stretch">
        <div className="w-[3px] shrink-0" style={{ background: regionColor }} />
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-sm font-black text-white truncate">{ev.venue}</span>
                {st && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                )}
                {!past && days === 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/90 text-white">今日</span>
                )}
                {!past && days === 1 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-400/80 text-white">明日</span>
                )}
                {!past && days > 1 && days <= 3 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/80 text-white">{days}日後</span>
                )}
              </div>
              <div className="text-xs font-medium text-white/40 mb-0.5">
                {fmtRange(ev.start, ev.end || ev.start)}
              </div>
              {ev.type && (
                <div className="text-xs font-medium text-white/25">{ev.type}</div>
              )}
              {pct >= 0 && (
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      className={`h-full rounded-full ${
                        pct === 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-indigo-400' : 'bg-amber-400'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 font-medium shrink-0">
                    {prog!.done}/{prog!.total}
                  </span>
                </div>
              )}
            </div>
            <ChevronRight
              size={14}
              className="text-white/20 group-hover:text-white/45 shrink-0 mt-0.5 transition-colors"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ text, count }: { text: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="text-[10px] font-bold text-white/35 uppercase tracking-[0.3em] shrink-0">{text}</div>
      {count !== undefined && count > 0 && (
        <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-black text-white shrink-0">
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

// ─── SectionEmpty ─────────────────────────────────────────────────────────────

function SectionEmpty({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="rounded-2xl py-7 px-4 text-center select-none"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="text-2xl mb-2" aria-hidden="true">🐟</div>
      <div className="text-sm font-medium text-white/35">{label}</div>
      {sub && <div className="text-xs text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── ServiceLinks ─────────────────────────────────────────────────────────────

const SERVICES = [
  { label: 'TranChat',             sub: '社内連絡ツール', href: 'https://tranchat1.mercury-group.co.jp/chat2_fed/public/index.html' },
  { label: 'Chronus',             sub: '退勤システム',   href: 'https://chronus.mercury-group.co.jp/index.html' },
  { label: 'マーキュリーアカデミア', sub: '研修・学習',    href: 'https://www.haken-school.com/mercury-academia/top/' },
] as const;

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
  const [showEventPicker, setShowEventPicker]     = useState(false);
  const [showPermissionToast, setShowPermissionToast] = useState(false);
  const [staffBreakdown, setStaffBreakdown]       = useState<StaffBreakdown | null>(null);
  const [staffLoading, setStaffLoading]           = useState(true);

  const today    = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateStr  = useMemo(
    () => new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    [],
  );
  const fx      = useFxLevel();
  const showBg  = fx !== 'off';

  const rootRef            = useRef<HTMLDivElement>(null);
  const fishSectionRef     = useRef<HTMLDivElement>(null);
  const fishScrollProgress = useRef(0);

  // ── BottomSheet drag-to-close ──────────────────────────────────────────────
  const sheetRef         = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const dragStartY       = useRef(0);
  const dragStartTime    = useRef(0);

  function handleHandlePointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
    dragStartTime.current = Date.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleHandlePointerMove(e: React.PointerEvent) {
    const dy = e.clientY - dragStartY.current;
    if (dy > 0 && sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  }
  function handleHandlePointerUp(e: React.PointerEvent) {
    const dy = e.clientY - dragStartY.current;
    const velocity = Date.now() - dragStartTime.current > 0
      ? (dy / (Date.now() - dragStartTime.current)) * 1000
      : 0;
    if (dy > 80 || velocity > 400) {
      setShowEventPicker(false);
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
      sheetRef.current.style.transform  = '';
      setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = ''; }, 320);
    }
  }

  // ── データ取得 ──────────────────────────────────────────────────────────────
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

  // ── GSAP ScrollTrigger ──────────────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = scrollContainerRef?.current ?? undefined;

    const ctx = gsap.context(() => {
      // 魚セクションのスクロール進捗 (scrub=1 でスムーズ追従)
      if (fishSectionRef.current && scroller) {
        ScrollTrigger.create({
          trigger: fishSectionRef.current,
          scroller,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
          onUpdate: (self) => { fishScrollProgress.current = self.progress; },
        });
      }

      // 各セクションのフェードイン
      gsap.utils.toArray<HTMLElement>('.hv-reveal', root).forEach(el => {
        gsap.from(el, {
          y: 36,
          opacity: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    }, root);

    return () => ctx.revert();
  }, [scrollContainerRef]);

  // ── イベント計算 ────────────────────────────────────────────────────────────
  const in7 = useMemo(() => addDays(today, 7), [today]);

  const { todayEvents, upcomingWeek } = useMemo(() => {
    const active = events.filter(e => e.status !== 'cancelled');
    return {
      todayEvents: active
        .filter(e => e.start && e.start <= today && today <= (e.end || e.start))
        .sort((a, b) => a.start.localeCompare(b.start)),
      upcomingWeek: active
        .filter(e => e.start && e.start > today && e.start <= in7)
        .sort((a, b) => a.start.localeCompare(b.start)),
    };
  }, [events, today, in7]);

  const nextEvent = useMemo(
    () =>
      events
        .filter(e => e.status !== 'cancelled' && e.start >= today)
        .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null,
    [events, today],
  );
  const daysToNext = nextEvent
    ? Math.ceil(
        (new Date(nextEvent.start + 'T00:00:00').getTime() -
          new Date(today + 'T00:00:00').getTime()) / 86400000,
      )
    : null;

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

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div ref={rootRef}>

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — EXロゴ + ライブ時計（Editorial hero）
        ════════════════════════════════════════════════════════════════════ */}
        <section className="min-h-[90svh] flex flex-col justify-between pt-8 pb-10 px-4 md:px-8 lg:px-12 relative">

          {/* Top kicker */}
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <span className="text-[9px] font-bold text-white/25 uppercase tracking-[0.4em]">
              Mercury Group — EX事業部
            </span>
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.25em] tabular-nums">
              {new Date().getFullYear()}.{String(new Date().getMonth()+1).padStart(2,'0')}.{String(new Date().getDate()).padStart(2,'0')}
            </span>
          </motion.div>

          {/* Center: clock */}
          <div className="flex flex-col items-center gap-5 py-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <LiveClock />
            </motion.div>

            {/* thin divider */}
            <motion.div
              className="w-12 h-px"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.38 }}
            />

            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
            >
              <div className="text-sm font-bold text-white/55 tracking-wide">{dateStr}</div>
            </motion.div>

            {/* 次イベントの callout */}
            {nextEvent && daysToNext !== null && daysToNext <= 7 && (
              <motion.button
                onClick={() => onSelectEvent(nextEvent)}
                className="flex items-center gap-2 group mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.48 }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    daysToNext === 0 ? 'bg-rose-400 animate-pulse' : 'bg-amber-300'
                  }`}
                />
                <span className="text-xs font-medium text-white/50 group-hover:text-white/80 transition-colors">
                  {nextEvent.venue}
                  <span className={`ml-1.5 font-bold ${daysToNext === 0 ? 'text-rose-300' : 'text-amber-300'}`}>
                    {daysToNext === 0 ? '今日開催' : `あと${daysToNext}日`}
                  </span>
                </span>
                <ChevronRight size={12} className="text-white/25 group-hover:text-white/50 shrink-0 transition-colors" />
              </motion.button>
            )}
          </div>

          {/* Bottom: EX badge + scroll hint */}
          <div className="flex items-end justify-between">
            <motion.div
              className="flex flex-col items-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
            >
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-[9px] font-medium text-white/25 uppercase tracking-widest">scroll</span>
                <ChevronDown size={13} className="text-white/20" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <EXBadge size={64} />
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — 3D 魚シーン（スクロール連動）
        ════════════════════════════════════════════════════════════════════ */}
        <section
          ref={fishSectionRef}
          className="relative overflow-hidden"
          style={{ height: '60svh' }}
        >
          {/* 透明 Canvas: 背後の GLSL 海が透けて見える */}
          {showBg && (
            <div className="absolute inset-0">
              <Suspense fallback={null}>
                <HomeFishScene scrollProgressRef={fishScrollProgress} />
              </Suspense>
            </div>
          )}
          <div className="relative z-10 h-full flex items-end justify-center pb-6 pointer-events-none">
            <motion.p
              className="text-[10px] font-medium text-white/25 uppercase tracking-[0.3em]"
              animate={{ opacity: [0.25, 0.55, 0.25] }}
              transition={{ repeat: Infinity, duration: 2.6 }}
            >
              scroll to see the world move
            </motion.p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3 — 今日のイベント
        ════════════════════════════════════════════════════════════════════ */}
        <section className="min-h-[80svh] flex flex-col justify-center gap-6 px-4 md:px-6 lg:px-8 py-12">

          <div className="hv-reveal">
            <SectionLabel text="本日のイベント" count={todayEvents.length} />
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
          </div>

          {upcomingWeek.length > 0 && (
            <div className="hv-reveal">
              <SectionLabel text="直近7日のイベント" />
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
            </div>
          )}

          <button
            onClick={onNavigateCalendar}
            className="hv-reveal flex items-center gap-1.5 text-xs font-bold text-cyan-300/80 hover:text-cyan-200 transition-colors self-start"
          >
            <CalendarDays size={13} />
            カレンダーをすべて見る
            <ChevronRight size={13} />
          </button>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 4 — 今日の稼働人数
        ════════════════════════════════════════════════════════════════════ */}
        <section className="min-h-[80svh] flex flex-col justify-center gap-6 px-4 md:px-6 lg:px-8 py-12">

          <div className="hv-reveal">
            <SectionLabel text="本日の稼働人数" />
            <div className="flex items-baseline gap-3 mb-6">
              {staffLoading ? (
                <Skeleton className="h-28 w-48 rounded-xl" />
              ) : staffBreakdown !== null ? (
                <div style={{ textShadow: '0 0 50px rgba(34,200,216,0.45), 0 2px 10px rgba(0,0,0,0.5)' }}>
                  <CountUp
                    value={staffBreakdown.total}
                    className="text-[5.5rem] sm:text-[7rem] font-black text-white leading-none tabular-nums inline-block"
                  />
                  <span className="text-3xl font-black text-white/40 ml-2">人</span>
                </div>
              ) : (
                <span className="text-[5.5rem] font-black text-white/20">—</span>
              )}
            </div>
          </div>

          {/* 内訳グリッド */}
          <div className="hv-reveal grid grid-cols-3 gap-2">
            {staffLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))
              : staffBreakdown !== null
              ? ([
                  { label: '本社',    value: staffBreakdown.office,   cls: 'bg-blue-500/25 border-blue-400/40 text-blue-100' },
                  { label: 'イベント', value: staffBreakdown.event,   cls: 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100' },
                  { label: '外出',    value: staffBreakdown.dispatch, cls: 'bg-amber-500/25 border-amber-400/40 text-amber-100' },
                  { label: '公休',    value: staffBreakdown.rest,     cls: 'bg-violet-500/25 border-violet-400/40 text-violet-100' },
                  { label: '希望休',  value: staffBreakdown.request,  cls: 'bg-pink-500/25 border-pink-400/40 text-pink-100' },
                  { label: 'その他',  value: staffBreakdown.other,    cls: 'bg-slate-500/25 border-slate-400/40 text-slate-200' },
                ] as const).map(({ label, value, cls }) => (
                  <div key={label} className={`rounded-xl py-3 px-2 text-center border ${cls}`}>
                    <CountUp value={value} className="block font-black text-xl leading-none" />
                    <div className="text-[11px] font-medium text-white/60 mt-1">{label}</div>
                  </div>
                ))
              : null}
          </div>

          <button
            onClick={onOpenSchedule}
            className="hv-reveal flex items-center gap-1.5 text-xs font-bold text-cyan-300/80 hover:text-cyan-200 transition-colors self-start"
          >
            <CalendarDays size={13} />
            スケジュール詳細を確認
            <ChevronRight size={13} />
          </button>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 5 — 準備物リストを開く
        ════════════════════════════════════════════════════════════════════ */}
        <section className="min-h-[70svh] flex flex-col items-center justify-center gap-6 px-4 md:px-6 lg:px-8 py-12">

          <div className="hv-reveal text-center w-full max-w-sm">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">
              準備リスト
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-7 leading-tight">
              今日の準備は<br />できていますか？
            </h2>
            <RippleButton
              onClick={() => setShowEventPicker(true)}
              className="flex items-center justify-center gap-3 w-full rounded-2xl px-6 py-5 font-black text-lg text-white shadow-lg active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 60%, #0e7490 100%)' }}
            >
              <ClipboardList size={22} />
              準備物リストを開く
            </RippleButton>
          </div>

          <div className="hv-reveal w-full max-w-sm">
            <RippleButton
              onClick={() => {
                if (canEditEvent) onCreateEvent();
                else setShowPermissionToast(true);
              }}
              className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white rounded-2xl px-5 py-3.5 font-bold text-sm hover:bg-white/15 active:scale-[0.98] transition-all w-full"
            >
              <Plus size={16} />
              新規イベントを追加する
            </RippleButton>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 6 — マーキュリーサービス
        ════════════════════════════════════════════════════════════════════ */}
        <section className="min-h-[70svh] flex flex-col justify-center gap-4 px-4 md:px-6 lg:px-8 pb-28 md:pb-12 py-12">

          <div className="hv-reveal">
            <SectionLabel text="マーキュリーサービス" />
            <div className="flex flex-col gap-2">
              {SERVICES.map(svc => (
                <a
                  key={svc.label}
                  href={svc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white/10 border border-white/15 text-white rounded-2xl px-5 py-4 hover:bg-white/15 active:scale-[0.98] transition-all"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white leading-tight">{svc.label}</div>
                    <div className="text-xs font-medium text-white/50 mt-0.5">{svc.sub}</div>
                  </div>
                  <ExternalLink size={14} className="text-white/35 shrink-0 ml-3" />
                </a>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenSchedule}
            className="hv-reveal flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
          >
            <CalendarDays size={14} className="text-white/35 shrink-0" />
            スケジュール確認
            <ChevronRight size={14} />
          </button>
        </section>

      </div>

      {/* ── Event Picker Bottom Sheet ─────────────────────────────────────────── */}
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
                <div
                  className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                  onPointerDown={handleHandlePointerDown}
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={handleHandlePointerUp}
                >
                  <div className="w-10 h-1 bg-slate-200 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0 border-b border-slate-100">
                  <div>
                    <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-0.5">準備物リスト</div>
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
                <div ref={contentScrollRef} className="overflow-y-auto px-4 pt-3 pb-12 space-y-4">
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
                            const isToday   = until === 0;
                            const isSoon    = until > 0 && until <= 7;
                            const isOngoing = until < 0 && (ev.end || ev.start) >= today;
                            const urgencyBadge = isToday
                              ? { label: '今日',   cls: 'bg-rose-500 text-white' }
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
                                  <span className="text-[10px] font-bold text-white/70 leading-none">{s.month}月</span>
                                  <span className="text-xl font-black text-white leading-none mt-0.5">{s.day}</span>
                                  <span className="text-[10px] font-bold text-white/80 leading-none mt-0.5">{s.dow}</span>
                                </div>
                                <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-slate-900 text-sm truncate">{ev.venue}</span>
                                    {urgencyBadge && (
                                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}>
                                        {urgencyBadge.label}
                                      </span>
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
