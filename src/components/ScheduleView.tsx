import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import {
  fetchMonthSchedule,
  updateStaffDay,
  shiftInfo,
  SHIFT_TYPES,
  type DayEntry,
  type MonthSchedule,
} from '../lib/exSchedule';

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
const BG = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1280&q=65';

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

interface CellKey { staffId: string; dayIndex: number }

interface TypePickerProps {
  anchor: { x: number; y: number };
  current: string;
  onSelect: (type: string) => void;
  onClose: () => void;
}

function TypePicker({ anchor, current, onSelect, onClose }: TypePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // ビューポートからはみ出さないよう位置補正
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(anchor.y, window.innerHeight - 280),
    left: Math.min(anchor.x, window.innerWidth - 220),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={{ ...style, background: 'rgba(15,23,42,0.97)' }}
      className="w-52 rounded-2xl border border-white/20 overflow-hidden shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <span className="text-[11px] font-black text-white/60 uppercase tracking-widest">シフト変更</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="p-1.5 grid grid-cols-2 gap-1">
        {Object.entries(SHIFT_TYPES).map(([key, info]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-left transition-all hover:scale-[1.03] active:scale-95 ${
              current === key ? 'ring-2 ring-white/40' : ''
            }`}
            style={{ background: info.bg }}
          >
            <span className="text-sm leading-none">{info.emoji}</span>
            <span className="text-xs font-black leading-none" style={{ color: info.text }}>{info.label}</span>
          </button>
        ))}
        <button
          onClick={() => onSelect('')}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-left transition-all hover:scale-[1.03] active:scale-95 bg-white/5"
        >
          <span className="text-sm leading-none">—</span>
          <span className="text-xs font-black text-white/40 leading-none">未設定</span>
        </button>
      </div>
    </div>
  );
}

export default function ScheduleView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<{ cell: CellKey; pos: { x: number; y: number } } | null>(null);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const result = await fetchMonthSchedule(y, m);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(year, month); }, [year, month, load]);

  const totalDays = daysInMonth(year, month);
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);
  const staffIds = data ? Object.keys(data.schedule).sort((a, b) => a.localeCompare(b, 'ja')) : [];

  const getEntry = (staffId: string, dayIndex: number): DayEntry | undefined =>
    data?.schedule[staffId]?.[dayIndex];

  const handleCellClick = (staffId: string, dayIndex: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPicker({ cell: { staffId, dayIndex }, pos: { x: rect.left, y: rect.bottom + 4 } });
  };

  const handleTypeSelect = async (type: string) => {
    if (!picker || !data) return;
    const { staffId, dayIndex } = picker.cell;
    setPicker(null);

    // 楽観的更新
    const newSchedule = { ...data.schedule };
    const days = newSchedule[staffId] ? [...newSchedule[staffId]] : [];
    days[dayIndex] = { ...(days[dayIndex] ?? {}), type };
    newSchedule[staffId] = days;
    setData({ ...data, schedule: newSchedule });

    setSaving(true);
    try {
      await updateStaffDay(staffId, year, month, dayIndex, type);
    } catch {
      // revert on failure
      await load(year, month);
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };

  // 今月の各シフトタイプ集計
  const summary = staffIds.reduce<Record<string, number>>((acc, sid) => {
    dayNumbers.forEach((_, di) => {
      const type = getEntry(sid, di)?.type;
      if (type) acc[type] = (acc[type] ?? 0) + 1;
    });
    return acc;
  }, {});

  return (
    <div
      className="relative flex flex-col h-full min-h-0 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,27,75,0.95) 100%)',
      }}
    >
      {/* 背景画像 */}
      <div
        className="absolute inset-0 -z-10 opacity-10"
        style={{ backgroundImage: `url(${BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />

      {/* ヘッダー */}
      <div
        className="shrink-0 px-4 md:px-6 pt-5 pb-4 border-b border-white/10"
        style={{ background: 'linear-gradient(to bottom, rgba(15,23,42,0.6) 0%, transparent 100%)' }}
      >
        <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">SCHEDULE</div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-2xl font-black text-white tabular-nums tracking-tight min-w-[7rem] text-center">
              {year}年{month}月
            </h2>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ChevronRight size={16} />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors">
              今月
            </button>
            <button onClick={() => load(year, month)} className={`w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={14} />
            </button>
            {saving && <span className="text-xs text-white/50 font-bold animate-pulse">保存中...</span>}
          </div>

          {/* 今月サマリーバッジ */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => {
              const info = shiftInfo(type);
              return (
                <div key={type} className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black" style={{ background: info.bg, color: info.text }}>
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                  <span className="opacity-70">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* グリッド */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/50 text-sm font-bold animate-pulse">読み込み中...</div>
        </div>
      ) : staffIds.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/40">
          <span className="text-4xl">📅</span>
          <div className="text-sm font-bold">この月のスケジュールデータがありません</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: `${120 + totalDays * 52}px` }}>
            <colgroup>
              <col style={{ width: 120 }} />
              {dayNumbers.map(d => <col key={d} style={{ width: 52 }} />)}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr style={{ background: 'rgba(15,23,42,0.92)' }}>
                {/* スタッフ列ヘッダー */}
                <th className="sticky left-0 z-30 px-3 py-2 text-left border-b border-r border-white/10 text-[10px] font-black text-white/40 uppercase tracking-widest"
                    style={{ background: 'rgba(15,23,42,0.97)' }}>
                  スタッフ
                </th>
                {dayNumbers.map(d => {
                  const date = new Date(year, month - 1, d);
                  const dow = date.getDay();
                  const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && d === now.getDate();
                  const isSun = dow === 0;
                  const isSat = dow === 6;
                  return (
                    <th key={d}
                      className={`px-0 py-2 text-center border-b border-white/10 text-[11px] font-black ${
                        isToday ? 'bg-indigo-600/40' : isSun ? 'bg-red-500/10' : isSat ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <div className={`leading-none ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-white/60'}`}>{d}</div>
                      <div className={`leading-none mt-0.5 text-[9px] ${isSun ? 'text-red-400/70' : isSat ? 'text-blue-400/70' : 'text-white/30'}`}>
                        {DAYS_JP[dow]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffIds.map((staffId, si) => {
                const displayName = data?.staffNames?.[staffId] ?? staffId;
                return (
                  <tr key={staffId} className={si % 2 === 0 ? '' : ''} style={{ background: si % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    {/* スタッフ名 */}
                    <td className="sticky left-0 z-10 px-3 py-1 border-r border-white/10 text-xs font-black text-white/80 truncate max-w-[120px]"
                        style={{ background: si % 2 === 0 ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.92)' }}>
                      {displayName}
                    </td>
                    {dayNumbers.map((_, di) => {
                      const entry = getEntry(staffId, di);
                      const info = entry?.type ? shiftInfo(entry.type) : null;
                      const date = new Date(year, month - 1, di + 1);
                      const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && (di + 1) === now.getDate();
                      const isSun = date.getDay() === 0;
                      const isSat = date.getDay() === 6;
                      return (
                        <td
                          key={di}
                          onClick={(e) => handleCellClick(staffId, di, e)}
                          className={`px-1 py-1 text-center cursor-pointer transition-all hover:brightness-125 border-b border-white/5 ${
                            isToday ? 'bg-indigo-600/15' : isSun ? 'bg-red-500/5' : isSat ? 'bg-blue-500/5' : ''
                          }`}
                        >
                          {info ? (
                            <div
                              className="mx-auto w-[38px] rounded-lg py-0.5 text-[9px] font-black leading-tight text-center truncate"
                              style={{ background: info.bg, color: info.text }}
                            >
                              {info.emoji}
                            </div>
                          ) : (
                            <div className="mx-auto w-[38px] rounded-lg py-0.5 text-[9px] font-black text-white/10 text-center">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* シフトタイプ凡例（フッター） */}
      <div className="shrink-0 px-4 py-2.5 border-t border-white/10 flex items-center gap-2 flex-wrap overflow-x-auto">
        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest shrink-0">凡例</span>
        {Object.entries(SHIFT_TYPES).map(([key, info]) => (
          <div key={key} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0"
               style={{ background: info.bg, color: info.text }}>
            {info.emoji} {info.label}
          </div>
        ))}
      </div>

      {/* タイプピッカー */}
      {picker && (
        <TypePicker
          anchor={picker.pos}
          current={getEntry(picker.cell.staffId, picker.cell.dayIndex)?.type ?? ''}
          onSelect={handleTypeSelect}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
