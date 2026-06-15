import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, X, ClipboardList, Plus, CalendarDays } from 'lucide-react';
import type { Event } from '../types';
import { rs, fmtDateJP, fmtDateRange } from '../lib/eventHelpers';

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

function statusPill(status: string | undefined): { label: string; cls: string } | null {
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-50 text-amber-600 border border-amber-200' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-sky-50 text-sky-600 border border-sky-200' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-blue-50 text-blue-600 border border-blue-200' };
    case 'cancelled':   return { label: 'キャンセル', cls: 'bg-red-50 text-red-500 border border-red-200' };
    default:            return null;
  }
}

// ─── EventCard (light) ────────────────────────────────────────────────────────

function EventCard({ ev, today }: { ev: Event; today: string }) {
  const pill = statusPill(ev.status);
  const days = daysUntil(ev.start, today);
  const regionColor = rs(ev.region || '').dot;
  const dateInfo = fmtDateJP(ev.start);

  return (
    <div className="flex items-stretch rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm">
      <div className="w-1 shrink-0" style={{ background: regionColor }} />
      <div className="flex items-center gap-3 px-3 py-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">{ev.venue}</div>
          <div className="text-xs text-slate-400 mt-0.5">{dateInfo.label}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {days === 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">今日</span>
          )}
          {days === 1 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-400 text-white">明日</span>
          )}
          {pill && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pill.cls}`}>{pill.label}</span>
          )}
          <ChevronRight size={14} className="text-slate-300" />
        </div>
      </div>
    </div>
  );
}

// ─── HomeView ─────────────────────────────────────────────────────────────────

export default function HomeView({
  events,
  onSelectEvent,
  onSelectPrepEvent,
  onCreateEvent,
  onNavigateCalendar,
  canEditEvent,
}: Props) {
  const [showEventPicker, setShowEventPicker]         = useState(false);
  const [showPermissionToast, setShowPermissionToast] = useState(false);

  const today   = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateStr = useMemo(
    () => new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' }),
    [],
  );

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

  useEffect(() => {
    if (!showPermissionToast) return;
    const t = setTimeout(() => setShowPermissionToast(false), 2500);
    return () => clearTimeout(t);
  }, [showPermissionToast]);

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
    <div className="px-4 pt-5 pb-28 md:pb-8 flex flex-col gap-5 max-w-lg mx-auto">

      {/* Date header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-sm font-bold text-slate-400 tracking-wide"
      >
        {dateStr}
      </motion.div>

      {/* Today section */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.04 }}
          className="flex items-center gap-2 mb-3"
        >
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Today</span>
          {todayEvents.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-black text-white">
              {todayEvents.length}
            </span>
          )}
          <div className="flex-1 h-px bg-slate-100" />
        </motion.div>

        {todayEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-2xl py-6 px-4 text-center bg-slate-50 border border-slate-100"
          >
            <div className="text-sm font-medium text-slate-400">本日のイベントはありません</div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayEvents.map((ev, i) => (
              <motion.button
                key={ev.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.08 + i * 0.06 }}
                onClick={() => onSelectEvent(ev)}
                className="w-full text-left active:scale-[0.98] transition-transform"
              >
                <EventCard ev={ev} today={today} />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* This week section */}
      {upcomingWeek.length > 0 && (
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="flex items-center gap-2 mb-3"
          >
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">This Week</span>
            <div className="flex-1 h-px bg-slate-100" />
          </motion.div>
          <div className="flex flex-col rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm">
            {upcomingWeek.map((ev, i) => {
              const dateInfo = fmtDateJP(ev.start);
              const regionColor = rs(ev.region || '').dot;
              return (
                <motion.button
                  key={ev.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.16 + i * 0.05 }}
                  onClick={() => onSelectEvent(ev)}
                  className="flex items-center gap-2 py-2.5 px-3 border-b border-slate-50 last:border-0 text-left active:bg-slate-50 transition-colors w-full"
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: regionColor }} />
                  <span className="flex-1 text-xs font-medium text-slate-700 truncate min-w-0">{ev.venue}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{dateInfo.label}</span>
                  <ChevronRight size={12} className="text-slate-300 shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.22 }}
        onClick={onNavigateCalendar}
        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors self-start"
      >
        <CalendarDays size={12} />
        カレンダーをすべて見る
        <ChevronRight size={12} />
      </motion.button>

      {/* Prep CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.26 }}
        className="flex flex-col gap-2"
      >
        <button
          onClick={() => setShowEventPicker(true)}
          className="flex items-center justify-center gap-2 w-full rounded-2xl px-5 py-4 font-black text-sm text-white active:scale-[0.98] transition-all"
          style={{ background: 'var(--accent)', boxShadow: '0 4px 16px rgba(37,99,235,0.25)' }}
        >
          <ClipboardList size={18} />
          準備物リストを開く
        </button>

        <button
          onClick={() => { if (canEditEvent) onCreateEvent(); else setShowPermissionToast(true); }}
          className="flex items-center justify-center gap-2 w-full rounded-2xl px-5 py-3 font-bold text-sm text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100 active:scale-[0.98] transition-all"
        >
          <Plus size={15} />
          新規イベントを追加する
        </button>
      </motion.div>

      {/* Event Picker Bottom Sheet */}
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
