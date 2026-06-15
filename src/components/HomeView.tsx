import { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ExternalLink, X, ClipboardList, Plus,
  CalendarDays, ChevronDown,
} from 'lucide-react';
import Lenis from 'lenis';
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

const HomeFishScene = lazy(() => import('./webgl/HomeFishScene'));

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

// ─── Mercury "M" mark (SVG approximation) ────────────────────────────────────

function MercuryMark({
  size = 40,
  color = 'currentColor',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.88)}
      viewBox="0 0 124 110"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 96 C12 96 10 34 12 26 C14 18 23 13 30 22 L56 68 L82 22 C89 13 98 18 100 28 C102 38 100 60 100 66 C100 74 104 80 112 72"
        stroke={color}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="116" cy="14" r="13" fill={color} />
    </svg>
  );
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
    return { label: '完了', cls: 'bg-white/8 border border-white/10 text-white/35' };
  switch (status) {
    case 'in_progress': return { label: '準備中',   cls: 'bg-amber-500/15 border border-amber-400/25 text-amber-300' };
    case 'waiting':     return { label: '入荷待ち', cls: 'bg-sky-500/15 border border-sky-400/25 text-sky-300' };
    case 'ready':       return { label: '準備完了', cls: 'bg-emerald-500/15 border border-emerald-400/25 text-emerald-300' };
    case 'cancelled':   return { label: 'キャンセル', cls: 'bg-red-500/15 border border-red-400/25 text-red-300' };
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

// ─── LiveClock (isolate renders to avoid parent re-render) ────────────────────

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    <div className="select-none tabular-nums">
      <div
        className="text-4xl sm:text-5xl font-black text-white leading-none tracking-tighter"
        style={{ textShadow: '0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2)' }}
      >
        {pad(now.getHours())}
        <span className="text-white/25 animate-pulse">:</span>
        {pad(now.getMinutes())}
      </div>
      <div className="text-base font-bold text-white/20 mt-1 tracking-[0.35em]">
        {pad(now.getSeconds())}
      </div>
    </div>
  );
}

// ─── EventCard — dark glass ───────────────────────────────────────────────────

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
      whileHover={{ y: -2, boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)' }}
      className="w-full text-left rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: 'rgba(0,0,0,0.52)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset',
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
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">今日</span>
                )}
                {!past && days === 1 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-400/80 text-white">明日</span>
                )}
                {!past && days > 1 && days <= 3 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/80 text-white">{days}日後</span>
                )}
              </div>
              <div className="text-xs font-medium text-white/35 mb-0.5">
                {fmtRange(ev.start, ev.end || ev.start)}
              </div>
              {ev.type && (
                <div className="text-xs text-white/20">{ev.type}</div>
              )}
              {pct >= 0 && (
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex-1 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      className={`h-full rounded-full ${
                        pct === 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-blue-400' : 'bg-amber-400'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 }}
                    />
                  </div>
                  <span className="text-[10px] text-white/25 font-medium shrink-0">
                    {prog!.done}/{prog!.total}
                  </span>
                </div>
              )}
            </div>
            <ChevronRight
              size={14}
              className="text-white/15 group-hover:text-white/40 shrink-0 mt-0.5 transition-colors"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── SectionLabel — dark premium minimal ─────────────────────────────────────

function SectionLabel({ text, count, sub }: { text: string; count?: number; sub?: string }) {
  return (
    <div className="mb-3 md:mb-5">
      <div className="flex items-center gap-3">
        <div className="text-[9px] font-black text-white/25 uppercase tracking-[0.4em] shrink-0">{text}</div>
        {count !== undefined && count > 0 && (
          <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-black text-white shrink-0">
            {count}
          </span>
        )}
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
      {sub && <div className="text-xs font-medium text-white/15 mt-1 ml-0">{sub}</div>}
    </div>
  );
}

// ─── SectionEmpty — dark glass ────────────────────────────────────────────────

function SectionEmpty({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="rounded-2xl py-8 px-4 text-center select-none"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-2xl mb-2 opacity-40" aria-hidden="true">◦</div>
      <div className="text-sm font-medium text-white/25">{label}</div>
      {sub && <div className="text-xs text-white/15 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Service links ────────────────────────────────────────────────────────────

const SERVICES = [
  { label: 'TranChat',              sub: '社内連絡ツール', href: 'https://tranchat1.mercury-group.co.jp/chat2_fed/public/index.html' },
  { label: 'Chronus',              sub: '退勤システム',   href: 'https://chronus.mercury-group.co.jp/index.html' },
  { label: 'マーキュリーアカデミア',  sub: '研修・学習',    href: 'https://www.haken-school.com/mercury-academia/top/' },
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
  const [showEventPicker, setShowEventPicker]         = useState(false);
  const [showPermissionToast, setShowPermissionToast] = useState(false);
  const [staffBreakdown, setStaffBreakdown]           = useState<StaffBreakdown | null>(null);
  const [staffLoading, setStaffLoading]               = useState(true);

  const today   = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateStr = useMemo(
    () => new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' }),
    [],
  );

  const fx      = useFxLevel();
  const showBg  = fx !== 'off';

  const rootRef            = useRef<HTMLDivElement>(null);
  const fishSectionRef     = useRef<HTMLDivElement>(null);
  const fishScrollProgress = useRef(0);

  // bottom-sheet drag state
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
    const vel = Date.now() - dragStartTime.current > 0
      ? (dy / (Date.now() - dragStartTime.current)) * 1000 : 0;
    if (dy > 80 || vel > 400) {
      setShowEventPicker(false);
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.22,1,0.36,1)';
      sheetRef.current.style.transform  = '';
      setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = ''; }, 320);
    }
  }

  // toast auto-close
  useEffect(() => {
    if (!showPermissionToast) return;
    const t = setTimeout(() => setShowPermissionToast(false), 2500);
    return () => clearTimeout(t);
  }, [showPermissionToast]);

  // staff data
  useEffect(() => {
    setStaffLoading(true);
    fetchTodayStaffBreakdown()
      .then(bd => setStaffBreakdown(bd))
      .finally(() => setStaffLoading(false));
  }, [today]);

  // ── Lenis smooth scroll on the App scroll container ──────────────────────────
  useEffect(() => {
    const wrapper = scrollContainerRef?.current;
    if (!wrapper) return;

    const lenis = new Lenis({
      wrapper,
      lerp: 0.1,
      duration: 1.4,
      smoothWheel: true,
      syncTouch: false,
    } as ConstructorParameters<typeof Lenis>[0]);

    const raf = (time: number) => lenis.raf(time);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', () => ScrollTrigger.update());

    return () => {
      lenis.off('scroll', () => ScrollTrigger.update());
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [scrollContainerRef]);

  // ── GSAP: section reveals + fish scrub ───────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = scrollContainerRef?.current ?? undefined;

    const ctx = gsap.context(() => {
      // fish scrub
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

      // section reveals with stagger for card lists
      gsap.utils.toArray<HTMLElement>('.hv-reveal', root).forEach(el => {
        gsap.from(el, {
          y: 32,
          opacity: 0,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top 88%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      // card stagger within lists
      gsap.utils.toArray<HTMLElement>('.hv-card-list', root).forEach(list => {
        const cards = list.querySelectorAll<HTMLElement>('.hv-card');
        if (cards.length === 0) return;
        gsap.from(cards, {
          y: 24,
          opacity: 0,
          duration: 0.5,
          stagger: 0.07,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: list,
            scroller,
            start: 'top 88%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    }, root);

    return () => ctx.revert();
  }, [scrollContainerRef]);

  // ── event calculations ────────────────────────────────────────────────────────
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
    () => events
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
    () => events
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

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1 — HERO: Mercury mark + EX badge + clock
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex flex-col px-4 md:px-8 lg:px-12 pt-4 md:pt-5 pb-5 md:pb-8 relative md:min-h-[100svh]">

          {/* Top brand bar */}
          <motion.div
            className="flex items-center justify-between shrink-0"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <div className="flex items-center gap-2.5">
              <MercuryMark size={26} color="rgba(255,255,255,0.45)" />
              <span className="text-[9px] font-bold text-white/22 uppercase tracking-[0.35em]">Mercury Group</span>
            </div>
            <span className="text-[9px] font-bold text-white/18 uppercase tracking-[0.3em]">EX事業部</span>
          </motion.div>

          {/* Center content */}
          <div className="flex flex-col items-center justify-center gap-4 py-5 md:flex-1 md:gap-8 md:py-10">

            {/* EXBadge with neon halo rings */}
            <motion.div
              className="relative hidden md:block"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {/* outer pulse ring */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{ width: 140, height: 140, border: '1px solid rgba(59,130,246,0.22)' }}
                animate={{ scale: [1, 1.7, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeOut' }}
              />
              {/* inner pulse ring */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{ width: 140, height: 140, border: '1px solid rgba(99,102,241,0.18)' }}
                animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 3.5, delay: 0.7, ease: 'easeOut' }}
              />
              {/* glow halo */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{
                  width: 160,
                  height: 160,
                  background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
                  filter: 'blur(8px)',
                }}
              />
              <EXBadge size={100} duration={6} />
            </motion.div>

            {/* Headline */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight tracking-tight">
                今日も、最高の
              </h1>
              <h1
                className="text-2xl sm:text-4xl font-black leading-tight tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #67e8f9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                イベントを。
              </h1>
            </motion.div>

            {/* Date + next event */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="text-xs font-bold text-white/35 tracking-wide">{dateStr}</div>
              {nextEvent && daysToNext !== null && daysToNext <= 7 && (
                <button
                  onClick={() => onSelectEvent(nextEvent)}
                  className="mt-2 flex items-center gap-1.5 group mx-auto"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${daysToNext === 0 ? 'bg-rose-400 animate-pulse' : 'bg-amber-300'}`} />
                  <span className="text-xs font-medium text-white/40 group-hover:text-white/70 transition-colors">
                    {nextEvent.venue}
                    <span className={`ml-1.5 font-bold ${daysToNext === 0 ? 'text-rose-300' : 'text-amber-300'}`}>
                      {daysToNext === 0 ? '今日開催' : `あと${daysToNext}日`}
                    </span>
                  </span>
                  <ChevronRight size={11} className="text-white/20 group-hover:text-white/45 shrink-0 transition-colors" />
                </button>
              )}
            </motion.div>
          </div>

          {/* Bottom bar: clock (left) + scroll hint (right) */}
          <div className="hidden md:flex items-end justify-between shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <LiveClock />
            </motion.div>

            <motion.div
              className="flex flex-col items-center gap-1 pb-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.5 }}
            >
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-0.5"
              >
                <span className="text-[8px] font-medium text-white/18 uppercase tracking-widest">scroll</span>
                <ChevronDown size={11} className="text-white/12" />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2 — 3D Fish (scroll-scrubbed)
        ══════════════════════════════════════════════════════════════════════ */}
        <section
          ref={fishSectionRef}
          className="relative overflow-hidden hidden md:block"
          style={{ height: '55svh' }}
        >
          {showBg && (
            <div className="absolute inset-0">
              <Suspense fallback={null}>
                <HomeFishScene scrollProgressRef={fishScrollProgress} />
              </Suspense>
            </div>
          )}
          <div className="relative z-10 h-full flex items-end justify-center pb-5 pointer-events-none">
            <motion.p
              className="text-[9px] font-medium text-white/18 uppercase tracking-[0.35em]"
              animate={{ opacity: [0.18, 0.4, 0.18] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              scroll to see the world move
            </motion.p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3 — Today's events
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-5 px-4 md:px-6 lg:px-8 py-5 md:py-12 md:min-h-[75svh] md:justify-center">

          <div className="hv-reveal">
            <SectionLabel text="Events Today" count={todayEvents.length} />
            {todayEvents.length === 0 ? (
              <SectionEmpty
                label="本日のイベントはありません"
                sub="次のイベントに備えて準備を進めましょう"
              />
            ) : (
              <div className="hv-card-list flex flex-col gap-2">
                {todayEvents.map(ev => (
                  <div key={ev.id} className="hv-card">
                    <SwipeActionCard
                      onAction={() => onSelectPrepEvent(ev)}
                      onTap={() => onSelectEvent(ev)}
                    >
                      <EventCard ev={ev} prog={prepProgressMap[ev.id]} today={today} />
                    </SwipeActionCard>
                  </div>
                ))}
              </div>
            )}
          </div>

          {upcomingWeek.length > 0 && (
            <div className="hv-reveal">
              <SectionLabel text="Coming This Week" />
              <div className="hv-card-list flex flex-col gap-2">
                {upcomingWeek.map(ev => (
                  <div key={ev.id} className="hv-card">
                    <SwipeActionCard
                      onAction={() => onSelectPrepEvent(ev)}
                      onTap={() => onSelectEvent(ev)}
                    >
                      <EventCard ev={ev} prog={prepProgressMap[ev.id]} today={today} />
                    </SwipeActionCard>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onNavigateCalendar}
            className="hv-reveal flex items-center gap-1.5 text-[11px] font-bold text-white/30 hover:text-white/60 transition-colors self-start"
          >
            <CalendarDays size={12} />
            カレンダーをすべて見る
            <ChevronRight size={12} />
          </button>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 4 — Staff KPI
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-5 px-4 md:px-6 lg:px-8 py-5 md:py-12 md:min-h-[75svh] md:justify-center">

          <div className="hv-reveal">
            <SectionLabel text="Team Operations" sub="本日の稼働状況" />
            <div className="flex items-baseline gap-3 mb-6">
              {staffLoading ? (
                <Skeleton className="h-28 w-48 rounded-xl" />
              ) : staffBreakdown !== null ? (
                <div>
                  <div style={{ textShadow: '0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2)' }}>
                    <CountUp
                      value={staffBreakdown.total}
                      className="text-5xl sm:text-[7rem] font-black text-white leading-none tabular-nums inline-block"
                    />
                  </div>
                  <span className="text-3xl font-black text-white/25 ml-2">人</span>
                </div>
              ) : (
                <span className="text-5xl sm:text-[5.5rem] font-black text-white/15">—</span>
              )}
            </div>
          </div>

          <div className="hv-reveal grid grid-cols-3 gap-2">
            {staffLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))
              : staffBreakdown !== null
              ? ([
                  { label: '本社',    value: staffBreakdown.office,   glow: 'rgba(59,130,246,0.5)',  cls: 'bg-blue-500/12 border-blue-400/18 text-blue-300' },
                  { label: 'イベント', value: staffBreakdown.event,   glow: 'rgba(16,185,129,0.5)',  cls: 'bg-emerald-500/12 border-emerald-400/18 text-emerald-300' },
                  { label: '外出',    value: staffBreakdown.dispatch, glow: 'rgba(245,158,11,0.5)',  cls: 'bg-amber-500/12 border-amber-400/18 text-amber-300' },
                  { label: '公休',    value: staffBreakdown.rest,     glow: 'rgba(139,92,246,0.5)',  cls: 'bg-violet-500/12 border-violet-400/18 text-violet-300' },
                  { label: '希望休',  value: staffBreakdown.request,  glow: 'rgba(236,72,153,0.5)',  cls: 'bg-pink-500/12 border-pink-400/18 text-pink-300' },
                  { label: 'その他',  value: staffBreakdown.other,    glow: 'rgba(100,116,139,0.5)', cls: 'bg-slate-500/12 border-slate-400/18 text-slate-300' },
                ] as const).map(({ label, value, cls }) => (
                  <div key={label} className={`rounded-xl py-3 px-2 text-center border backdrop-blur-sm ${cls}`}>
                    <CountUp value={value} className="block font-black text-xl leading-none" />
                    <div className="text-[10px] font-medium text-white/40 mt-1">{label}</div>
                  </div>
                ))
              : null}
          </div>

          <button
            onClick={onOpenSchedule}
            className="hv-reveal flex items-center gap-1.5 text-[11px] font-bold text-white/30 hover:text-white/60 transition-colors self-start"
          >
            <CalendarDays size={12} />
            スケジュール詳細を確認
            <ChevronRight size={12} />
          </button>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 5 — Prep CTA
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex flex-col items-center gap-4 px-4 md:px-6 lg:px-8 py-5 md:py-12 md:min-h-[65svh] md:justify-center">

          <div className="hv-reveal text-center w-full max-w-sm">
            <SectionLabel text="Preparation" />
            <h2 className="text-xl sm:text-3xl font-black text-white mb-4 md:mb-8 leading-tight">
              今日の準備は<br />できていますか？
            </h2>
            <RippleButton
              onClick={() => setShowEventPicker(true)}
              className="flex items-center justify-center gap-3 w-full rounded-2xl px-5 py-4 md:px-6 md:py-5 font-black text-base text-white active:scale-[0.98] transition-all"
              style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #1d4ed8 100%)',
                boxShadow: '0 0 30px rgba(37,99,235,0.35), 0 4px 20px rgba(0,0,0,0.4)',
              }}
            >
              <ClipboardList size={20} />
              準備物リストを開く
            </RippleButton>
          </div>

          <div className="hv-reveal w-full max-w-sm">
            <RippleButton
              onClick={() => {
                if (canEditEvent) onCreateEvent();
                else setShowPermissionToast(true);
              }}
              className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-bold text-sm text-white/60 hover:text-white active:scale-[0.98] transition-all w-full"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Plus size={15} />
              新規イベントを追加する
            </RippleButton>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 6 — Mercury Services
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-3 px-4 md:px-6 lg:px-8 pb-28 md:pb-12 py-5 md:py-12 md:min-h-[60svh] md:justify-center">

          <div className="hv-reveal">
            <SectionLabel text="Mercury Services" />
            <div className="hv-card-list flex flex-col gap-2">
              {SERVICES.map(svc => (
                <a
                  key={svc.label}
                  href={svc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hv-card flex items-center justify-between rounded-2xl px-4 py-3 md:px-5 md:py-4 active:scale-[0.98] transition-all group"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white/75 group-hover:text-white leading-tight transition-colors">{svc.label}</div>
                    <div className="text-xs font-medium text-white/30 mt-0.5">{svc.sub}</div>
                  </div>
                  <ExternalLink size={13} className="text-white/20 group-hover:text-white/45 shrink-0 ml-3 transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Mercury mark watermark */}
          <div className="hv-reveal hidden md:flex justify-center mt-4 opacity-[0.08]">
            <MercuryMark size={48} color="white" />
          </div>
        </section>

      </div>

      {/* ── Event Picker Bottom Sheet ─────────────────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {showEventPicker && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEventPicker(false)}
              />
              <motion.div
                ref={sheetRef}
                className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[82dvh] flex flex-col overflow-hidden shadow-2xl"
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
                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">準備物リスト</div>
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
                      <div className="text-3xl mb-3 opacity-30" aria-hidden="true">◦</div>
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
