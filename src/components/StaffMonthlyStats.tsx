import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, CalendarDays } from 'lucide-react';
import { MEMBERS, MEMBER_READINGS, TYPE_LABEL, TYPE_CLASS, getDaysInMonth } from '../lib/exScheduleConstants';
import type { StatusType } from '../lib/exScheduleConstants';
import type { Event } from '../types';
import { rs } from '../lib/eventHelpers';

interface MonthData {
  schedule: Record<string, { type: StatusType; detail: string }[]>;
}

interface Props {
  monthData: MonthData | null;
  allEvents: Event[];
  year: number;
  month: number; // 0-based
}

interface EventDay {
  day: number;
  label: string;       // スケジュール全体表示に記載されたイベント名（detail）
  venue?: string;      // メインDBで一致したイベントの会場名
  region?: string;
}

interface MemberStats {
  name: string;
  counts: Record<StatusType, number>;
  eventCount: number;
  eventDays: EventDay[];
}

const STAT_ORDER: StatusType[] = ['event', 'carry', 'office', 'dispatch', 'training', 'standby', 'normal', 'request', 'absence', 'other'];
const DOW_JP = ['日', '月', '火', '水', '木', '金', '土'];

export default function StaffMonthlyStats({ monthData, allEvents, year, month }: Props) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const stats = useMemo<MemberStats[]>(() => {
    return MEMBERS.map(name => {
      const sched = monthData?.schedule[name] ?? [];
      const counts: Record<StatusType, number> = {
        normal: 0, request: 0, training: 0, dispatch: 0, standby: 0,
        event: 0, office: 0, absence: 0, other: 0, rest: 0, carry: 0,
      };
      const eventDays: EventDay[] = [];
      // メインDBで当月かつこのメンバーが担当のイベント（会場名・地域の補完用）
      const memberEvents = allEvents.filter(ev =>
        ev.assignees?.includes(name) &&
        (ev.start?.startsWith(monthPrefix) || ev.end?.startsWith(monthPrefix))
      );
      for (let i = 0; i < daysInMonth; i++) {
        const entry = sched[i];
        const type: StatusType = (entry && typeof entry === 'object' ? entry.type : 'rest') || 'rest';
        counts[type] = (counts[type] ?? 0) + 1;
        if (type === 'event') {
          const detail = (entry?.detail || '').trim();
          // メインDBの会場名と部分一致すれば地域色を補完
          const match = memberEvents.find(ev =>
            detail && (ev.venue?.includes(detail) || detail.includes(ev.venue || '')) ||
            ev.start?.startsWith(`${monthPrefix}-${String(i + 1).padStart(2, '0')}`)
          );
          eventDays.push({
            day: i + 1,
            label: detail || match?.venue || 'イベント',
            venue: match?.venue,
            region: match?.region,
          });
        }
      }
      return { name, counts, eventCount: counts.event, eventDays };
    }).sort((a, b) => {
      const ra = MEMBER_READINGS[a.name] ?? a.name;
      const rb = MEMBER_READINGS[b.name] ?? b.name;
      return ra.localeCompare(rb, 'ja');
    });
  }, [monthData, allEvents, daysInMonth, monthPrefix]);

  const selected = selectedMember ? stats.find(s => s.name === selectedMember) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={15} className="text-indigo-500" />
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{year}年{month + 1}月 記録</p>
      </div>

      {/* メンバーカードグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {stats.map(s => {
          const dimmed = s.eventCount === 0;
          return (
            <button
              key={s.name}
              onClick={() => setSelectedMember(s.name)}
              className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.98] hover:shadow-md ${
                dimmed
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-white border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-black text-slate-900 leading-tight">{s.name.replace('　', ' ')}</span>
                <ChevronRight size={14} className="text-slate-400 mt-0.5 shrink-0" />
              </div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-3xl font-black text-red-600 leading-none">{s.eventCount}</span>
                <span className="text-[11px] font-bold text-slate-500">イベント日</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([['office', s.counts.office], ['carry', s.counts.carry], ['dispatch', s.counts.dispatch]] as [StatusType, number][]).map(([t, n]) =>
                  n > 0 ? (
                    <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${TYPE_CLASS[t]}`}>
                      {TYPE_LABEL[t].split('(')[0]}
                      <span className="font-black">{n}</span>
                    </span>
                  ) : null
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* メンバー詳細モーダル */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
            />
            {/* モバイル: 下からスライド / PC: 中央モーダル */}
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[88dvh] flex flex-col
                         md:inset-0 md:m-auto md:h-fit md:max-h-[85vh] md:w-[min(880px,92vw)] md:rounded-3xl"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ヘッダー */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{year}年{month + 1}月の記録</p>
                  <h2 className="text-xl font-black text-slate-900">{selected.name.replace('　', ' ')}</h2>
                </div>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 本文: PCは2カラム */}
              <div className="overflow-y-auto flex-1 px-6 pb-6 pt-5 grid gap-6 md:grid-cols-2">
                {/* 左カラム: ステータス内訳 + ミニカレンダー */}
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">ステータス内訳</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STAT_ORDER.map(type => {
                        const count = selected.counts[type] ?? 0;
                        if (count === 0) return null;
                        return (
                          <div key={type} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${TYPE_CLASS[type]}`}>
                              {TYPE_LABEL[type].split('(')[0]}
                            </span>
                            <span className="text-sm font-black text-slate-800">{count}<span className="text-[10px] font-bold text-slate-400 ml-0.5">日</span></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">日別ステータス</p>
                    <MiniCalendar
                      year={year}
                      month={month}
                      schedule={monthData?.schedule[selected.name] ?? []}
                      daysInMonth={daysInMonth}
                    />
                  </div>
                </div>

                {/* 右カラム: 参加イベント */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    参加イベント（{selected.eventDays.length}日）
                  </p>
                  {selected.eventDays.length > 0 ? (
                    <div className="space-y-2">
                      {selected.eventDays.map(ed => {
                        const dow = DOW_JP[new Date(year, month, ed.day).getDay()];
                        const regionStyle = ed.region ? rs(ed.region) : null;
                        return (
                          <div
                            key={ed.day}
                            className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100"
                          >
                            <div
                              className="w-9 h-9 rounded-lg shrink-0 flex flex-col items-center justify-center bg-red-50 text-red-600"
                            >
                              <span className="text-sm font-black leading-none">{ed.day}</span>
                              <span className="text-[8px] font-bold leading-none mt-0.5">{dow}</span>
                            </div>
                            {regionStyle && (
                              <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: regionStyle.dot }} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-900 truncate">{ed.label}</p>
                              {ed.region && <p className="text-[11px] text-slate-500">{ed.region}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-6">今月の参加イベントなし</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniCalendar({ year, month, schedule, daysInMonth }: {
  year: number; month: number;
  schedule: { type: StatusType; detail: string }[];
  daysInMonth: number;
}) {
  const startDow = new Date(year, month, 1).getDay(); // 0=Sun
  const cells: (null | { day: number; type: StatusType })[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = schedule[d - 1];
    const type: StatusType = (entry && typeof entry === 'object' ? entry.type : 'rest') || 'rest';
    cells.push({ day: d, type });
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW_JP.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const cls = TYPE_CLASS[cell.type] || 'bg-slate-100 text-slate-400';
          return (
            <div
              key={cell.day}
              title={TYPE_LABEL[cell.type]}
              className={`aspect-square flex items-center justify-center rounded-lg text-[9px] font-bold ${cls}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
