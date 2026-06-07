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

function AnalogClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0') % 12;
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  const s = parseInt(parts.find(p => p.type === 'second')?.value ?? '0');
  const hDeg = h * 30 + m * 0.5;
  const mDeg = m * 6 + s * 0.1;
  const sDeg = s * 6;
  const hand = (deg: number, len: number, w: number, color: string) => {
    const r = deg * Math.PI / 180;
    return <line x1="32" y1="32" x2={32 + len * Math.sin(r)} y2={32 - len * Math.cos(r)}
      stroke={color} strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 - 90) * Math.PI / 180;
        const major = i % 3 === 0;
        return <line key={i}
          x1={32 + (major ? 22 : 25) * Math.cos(angle)} y1={32 + (major ? 22 : 25) * Math.sin(angle)}
          x2={32 + 28 * Math.cos(angle)} y2={32 + 28 * Math.sin(angle)}
          stroke={major ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)'} strokeWidth={major ? 2 : 1} />;
      })}
      {hand(hDeg, 15, 3, 'rgba(255,255,255,0.95)')}
      {hand(mDeg, 21, 2, 'rgba(255,255,255,0.85)')}
      {hand(sDeg, 24, 1.2, 'rgba(96,165,250,0.9)')}
      <circle cx="32" cy="32" r="2.5" fill="white" />
    </svg>
  );
}

function effectivePast(ev: Event, today: string): boolean {
  if (ev.status === 'cancelled') return false;
  return (ev.end || ev.start) < today;
}

function statusPill(status: string | undefined, isPast: boolean): { label: string; cls: string } | null {
  if (isPast || status === 'completed') return { label: '完了', cls: 'bg-slate-500/20 border border-slate-400/30 text-slate-300' };
  switch (status) {
    case 'in_progress': return { label: '準備中',    cls: 'bg-amber-500/20 border border-amber-400/30 text-amber-300' };
    case 'waiting':     return { label: '入荷待ち',  cls: 'bg-sky-500/20 border border-sky-400/30 text-sky-300' };
    case 'ready':       return { label: '準備完了',  cls: 'bg-indigo-500/20 border border-indigo-400/30 text-indigo-300' };
    case 'cancelled':   return { label: 'キャンセル',cls: 'bg-red-500/20 border border-red-400/30 text-red-300' };
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
      whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
      className="w-full text-left bg-white/10 backdrop-blur-sm rounded-2xl transition-all group overflow-hidden border border-white/15"
    >
      <div className="flex items-stretch">
        <div className="w-1 shrink-0" style={{ background: regionColor }} />
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5 shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-base font-black text-white truncate">{ev.venue}</span>
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
              <div className="text-xs text-white/50 font-mono">
                {fmtRange(ev.start, ev.end)}{ev.client ? ` · ${ev.client}` : ''}{ev.region ? ` · ${ev.region}` : ''}
              </div>
              {pct >= 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-indigo-400' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono shrink-0">{prog!.done}/{prog!.total}</span>
                </div>
              )}
            </div>
            <ChevronRight size={15} className="text-white/30 group-hover:text-white/70 shrink-0 mt-1 transition-colors" />
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
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!showPermissionToast) return;
    const t = setTimeout(() => setShowPermissionToast(false), 2500);
    return () => clearTimeout(t);
  }, [showPermissionToast]);

  useEffect(() => {
    const d = new Date();
    const url = `https://ex-2026-04-802549538762.us-west1.run.app/?year=${d.getFullYear()}&month=${d.getMonth() + 1}`;
    fetch(url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(r => r.json()).then((data: any) => {
        // TODO: APIレスポンスのフィールドパスを確認して調整してください
        if (Array.isArray(data?.days)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entry = data.days.find((x: any) => x.date === today);
          setStaffCount(entry?.count ?? entry?.staff_count ?? entry?.staffCount ?? null);
        } else if (data && typeof data === 'object') {
          const entry = data[today] ?? data[String(d.getDate())];
          setStaffCount(entry?.count ?? entry?.staff_count ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setStaffLoading(false));
  }, [today]);
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
    return { thisMonthCount: thisMonth.length, daysToNext };
  }, [events, today]);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 flex flex-col gap-5 px-4 pt-6 pb-32 max-w-xl mx-auto w-full">

        {/* Date header */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-end gap-4">
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
          <AnalogClock />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
            <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">今月</div>
            <div className="text-2xl font-black text-white leading-none">{stats.thisMonthCount}</div>
            <div className="text-[10px] text-white/40 mt-0.5">件</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
            <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">今日の稼働</div>
            <div className="text-2xl font-black text-white leading-none">
              {staffLoading ? '…' : staffCount !== null ? staffCount : '—'}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{!staffLoading && staffCount !== null ? '人' : ''}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
            <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">次イベント</div>
            <div className="text-2xl font-black text-white leading-none">
              {stats.daysToNext === null ? '—' : stats.daysToNext === 0 ? '今日' : stats.daysToNext}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              {stats.daysToNext !== null && stats.daysToNext > 0 ? '日後' : ''}
            </div>
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
              className="fixed inset-x-0 bottom-0 z-50 bg-slate-900/95 backdrop-blur-xl rounded-t-3xl max-h-[80dvh] flex flex-col overflow-hidden border-t border-white/10"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-9 h-1 bg-white/20 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0 border-b border-white/10">
                <div>
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">準備物リスト</div>
                  <h2 className="text-base font-black text-white">どのイベントに追加しますか？</h2>
                </div>
                <button
                  onClick={() => setShowEventPicker(false)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto px-4 pt-3 pb-10 space-y-4">
                {pickerEvents.length === 0 ? (
                  <div className="py-12 text-center text-sm text-white/40">進行中のイベントがありません</div>
                ) : (
                  pickerGroups.map(({ month, events: evs }) => (
                    <div key={month}>
                      <div className="text-[11px] font-black text-white/40 uppercase tracking-widest px-1 mb-2">{month}</div>
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
                              className="w-full text-left bg-white/10 rounded-2xl border border-white/15 flex items-stretch overflow-hidden hover:bg-white/15 active:scale-[0.98] transition-all"
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
                                  <span className="font-bold text-white text-sm truncate">{ev.venue}</span>
                                  {urgencyBadge && (
                                    <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}>{urgencyBadge.label}</span>
                                  )}
                                </div>
                                <div className="text-xs text-white/50 truncate">{fmtDateRange(ev.start, ev.end)}</div>
                              </div>
                              <div className="flex items-center pr-3">
                                <ChevronRight size={16} className="text-white/30 shrink-0" />
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
