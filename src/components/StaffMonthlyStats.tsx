import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, AlertTriangle, Download } from 'lucide-react';
import { MEMBERS, TYPE_LABEL, TYPE_CLASS, getDaysInMonth } from '../lib/exScheduleConstants';
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

interface MemberStats {
  name: string;
  counts: Record<StatusType, number>;
  eventCount: number;
  workDays: number;
  weekdays: number;
  events: Event[];
}

const WORK_STATUSES: StatusType[] = ['event', 'office', 'dispatch', 'training', 'standby', 'other'];
const STAT_ORDER: StatusType[] = ['event', 'office', 'dispatch', 'training', 'standby', 'normal', 'request', 'absence', 'other'];

function countWeekdays(year: number, month: number): number {
  const days = getDaysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function downloadCSV(stats: MemberStats[], weekdays: number, year: number, month: number) {
  const header = ['名前', 'イベント日数', '本社出勤日数', '外出日数', '研修日数', '待機日数', '公休日数', '希望休日数', '欠勤日数', 'その他日数', '稼働日数', `稼働率(平日${weekdays}日)`, '参加イベント件数'];
  const rows = stats.map(s => {
    const util = weekdays > 0 ? Math.round((s.workDays / weekdays) * 100) : 0;
    return [
      s.name,
      s.counts.event,
      s.counts.office,
      s.counts.dispatch,
      s.counts.training,
      s.counts.standby,
      s.counts.normal,
      s.counts.request,
      s.counts.absence,
      s.counts.other,
      s.workDays,
      `${util}%`,
      s.events.length,
    ];
  });
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `月次実績_${year}年${month + 1}月.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffMonthlyStats({ monthData, allEvents, year, month }: Props) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const weekdays = useMemo(() => countWeekdays(year, month), [year, month]);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const stats = useMemo<MemberStats[]>(() => {
    return MEMBERS.map(name => {
      const sched = monthData?.schedule[name] ?? [];
      const counts: Record<StatusType, number> = {
        normal: 0, request: 0, training: 0, dispatch: 0,
        standby: 0, event: 0, office: 0, absence: 0, other: 0, rest: 0,
      };
      for (let i = 0; i < daysInMonth; i++) {
        const entry = sched[i];
        const type: StatusType = (entry && typeof entry === 'object' ? entry.type : 'rest') || 'rest';
        counts[type] = (counts[type] ?? 0) + 1;
      }
      const workDays = WORK_STATUSES.reduce((s, t) => s + (counts[t] ?? 0), 0);
      const memberEvents = allEvents.filter(ev =>
        ev.assignees?.includes(name) &&
        (ev.start?.startsWith(monthPrefix) || ev.end?.startsWith(monthPrefix))
      );
      return { name, counts, eventCount: counts.event, workDays, weekdays, events: memberEvents };
    }).sort((a, b) => b.eventCount - a.eventCount);
  }, [monthData, allEvents, daysInMonth, monthPrefix, weekdays]);

  const unassignedEvents = useMemo(() =>
    allEvents.filter(ev =>
      (!ev.assignees || ev.assignees.length === 0) &&
      (ev.start?.startsWith(monthPrefix) || ev.end?.startsWith(monthPrefix)) &&
      ev.status !== 'cancelled'
    ), [allEvents, monthPrefix]);

  const selected = selectedMember ? stats.find(s => s.name === selectedMember) ?? null : null;

  return (
    <div className="space-y-4">
      {/* ヘッダー行: タイトル + CSV出力 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{year}年{month + 1}月 実績</p>
        <button
          onClick={() => downloadCSV(stats, weekdays, year, month)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
        >
          <Download size={13} />
          CSV出力
        </button>
      </div>

      {/* 未担当アラートバナー */}
      {unassignedEvents.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          <span>
            <span className="font-black">{unassignedEvents.length}件</span>のイベントに担当者が未設定です
            （{unassignedEvents.slice(0, 3).map(e => e.venue || e.id).join('、')}{unassignedEvents.length > 3 ? '…' : ''}）
          </span>
        </div>
      )}

      {/* メンバーカードグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const util = weekdays > 0 ? Math.round((s.workDays / weekdays) * 100) : 0;
          const overloaded = util > 100;
          const dimmed = s.eventCount === 0 && !overloaded;
          return (
            <button
              key={s.name}
              onClick={() => setSelectedMember(s.name)}
              className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.98] hover:shadow-md ${
                overloaded
                  ? 'bg-red-50 border-red-300 hover:border-red-400'
                  : dimmed
                  ? 'bg-slate-50 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-black text-slate-900 leading-tight">{s.name.replace('　', ' ')}</span>
                {overloaded
                  ? <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                  : <ChevronRight size={12} className="text-slate-400 mt-0.5 shrink-0" />
                }
              </div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-2xl font-black text-indigo-600">{s.eventCount}</span>
                <span className="text-[10px] font-bold text-slate-500">イベント日</span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] text-slate-500">本社</span>
                <span className="text-xs font-bold text-emerald-600">{s.counts.office}日</span>
                <span className="text-slate-300">|</span>
                <span className="text-[10px] text-slate-500">外出</span>
                <span className="text-xs font-bold text-orange-500">{s.counts.dispatch}日</span>
              </div>
              {/* 稼働率バー */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-slate-400 font-bold">稼働率</span>
                  <span className={`text-[9px] font-black ${overloaded ? 'text-red-600' : 'text-slate-500'}`}>{util}%</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overloaded ? 'bg-red-400' : 'bg-indigo-400'}`}
                    style={{ width: `${Math.min(util, 100)}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* メンバー詳細ドロワー */}
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
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col md:inset-y-4 md:right-4 md:left-auto md:w-[480px] md:rounded-3xl"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ドロワーヘッダー */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{year}年{month + 1}月</p>
                  <h2 className="text-lg font-black text-slate-900">{selected.name.replace('　', ' ')}</h2>
                </div>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-5 pt-4">
                {/* ステータス内訳チップ */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">ステータス内訳</p>
                  <div className="flex flex-wrap gap-2">
                    {STAT_ORDER.map(type => {
                      const count = selected.counts[type] ?? 0;
                      if (count === 0) return null;
                      return (
                        <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold ${TYPE_CLASS[type]}`}>
                          {TYPE_LABEL[type]}
                          <span className="font-black">{count}</span>
                        </span>
                      );
                    })}
                  </div>
                  {(() => {
                    const util = weekdays > 0 ? Math.round((selected.workDays / weekdays) * 100) : 0;
                    const overloaded = util > 100;
                    return (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${overloaded ? 'bg-red-400' : 'bg-indigo-400'}`}
                            style={{ width: `${Math.min(util, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-black ${overloaded ? 'text-red-600' : 'text-slate-600'}`}>
                          稼働{selected.workDays}日 / 平日{weekdays}日 ({util}%)
                          {overloaded && ' ⚠'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* ミニカレンダー */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">日別ステータス</p>
                  <MiniCalendar
                    year={year}
                    month={month}
                    schedule={monthData?.schedule[selected.name] ?? []}
                    daysInMonth={daysInMonth}
                  />
                </div>

                {/* 参加イベント一覧 */}
                {selected.events.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      参加イベント（{selected.events.length}件）
                    </p>
                    <div className="space-y-2">
                      {selected.events.map(ev => {
                        const regionStyle = rs(ev.region || '');
                        return (
                          <div
                            key={ev.id}
                            className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100"
                          >
                            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: regionStyle.dot }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-900 truncate">{ev.venue || ev.type}</p>
                              <p className="text-[11px] text-slate-500">{ev.start}{ev.end && ev.end !== ev.start ? ` - ${ev.end}` : ''}</p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">{ev.region}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selected.events.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-2">今月の参加イベントなし</p>
                )}
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
        {['日', '月', '火', '水', '木', '金', '土'].map(d => (
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
