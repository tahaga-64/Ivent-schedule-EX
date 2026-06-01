import type { MouseEvent as ReactMouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { Event } from '../types';
import {
  ts, rs,
  buildEventOptionalCaption, eventCoversDate, buildMonthGridCells,
} from '../lib/eventHelpers';

export const MAX_EVENTS_IN_DAY_CELL = 3;
export const MAX_EVENTS_IN_DAY_CELL_NARROW = 2;
const CAL_DAY_CELL_EVENTS_MAX_HEIGHT = '5.875rem';
const CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW = '8.125rem';
const CAL_DAY_CELL_EVENT_ROW_MIN_HEIGHT = '1.375rem';
export const CAL_EVENT_ROW_MIN_HEIGHT_TOUCH = '36px';

interface CalendarViewProps {
  events: Event[];
  year: number;
  month: number;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  onSelect: (event: Event) => void;
  onHover: (event: Event, e: ReactMouseEvent<HTMLElement>) => void;
  onHoverEnd: () => void;
  onCreateEvent: (data?: Partial<Event>) => void;
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  narrowViewport: boolean;
  densityPreview?: boolean;
  prepProgressMap?: Record<string, { total: number; done: number }>;
}

export function CalendarView({
  events, year, month, setYear, setMonth,
  onSelect, onHover, onHoverEnd, onCreateEvent, onOpenDayDetail,
  narrowViewport, densityPreview, prepProgressMap = {},
}: CalendarViewProps) {
  const cells = buildMonthGridCells(year, month);
  const maxEventsInCell = narrowViewport ? MAX_EVENTS_IN_DAY_CELL_NARROW : MAX_EVENTS_IN_DAY_CELL;
  const eventRowMinHeight = narrowViewport ? CAL_EVENT_ROW_MIN_HEIGHT_TOUCH : CAL_DAY_CELL_EVENT_ROW_MIN_HEIGHT;
  const eventsPanelMaxHeight = narrowViewport ? CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW : CAL_DAY_CELL_EVENTS_MAX_HEIGHT;

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const setToday = () => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); };

  const today = new Date();
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekRows = cells.length / 7;
  const isSixWeekMonth = weekRows >= 6;

  return (
    <div className="flex flex-col h-full">
      {densityPreview && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold leading-snug text-amber-900">
          開発プレビュー: URL に <code className="rounded bg-white/80 px-1">?calPreview=density</code> を付けた状態です。
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
          {monthNames[month]} <span className="text-slate-400 font-bold ml-1">{year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft size={20} /></button>
          <button onClick={setToday} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm mx-1">今日</button>
          <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div
        className="flex-1 grid min-h-0 grid-cols-7 border-t border-l border-slate-100"
        style={{ gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))` }}
      >
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
          <div key={d} className="border-r border-b border-slate-100 bg-slate-50/10 py-2 px-3">
            <span className={`text-[9px] font-black uppercase tracking-widest ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'}`}>{d}</span>
          </div>
        ))}

        {cells.map((cell, idx) => {
          const isSun = idx % 7 === 0;
          const isSatCal = idx % 7 === 6;
          const isToday = cell.current && today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === cell.day;
          const dayEvents = cell.current ? events.filter((ev) => eventCoversDate(ev, year, month, cell.day)) : [];
          const visibleEvents = dayEvents.slice(0, maxEventsInCell);
          const hiddenCount = Math.max(0, dayEvents.length - maxEventsInCell);

          return (
            <div
              key={idx}
              className={`
                group relative flex h-full min-h-0 flex-col overflow-hidden border-r border-b border-slate-100 px-1 pb-1.5 pt-1.5
                ${cell.current ? 'bg-white' : 'bg-slate-50/20'}
                ${isSixWeekMonth
                  ? 'min-h-[104px] sm:min-h-[112px] md:min-h-[118px] lg:min-h-[122px] xl:min-h-[128px] 2xl:min-h-[136px]'
                  : 'min-h-[128px] sm:min-h-[136px] md:min-h-[144px] lg:min-h-[152px] xl:min-h-[160px]'}
              `}
            >
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                {cell.current && isToday && (
                  <div className="absolute inset-0 bg-indigo-50/50 ring-1 ring-inset ring-indigo-100/80" />
                )}
              </div>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex h-7 shrink-0 items-center border-b border-slate-100/90 px-0.5">
                  <span className={`
                    inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md text-[13px] font-bold tabular-nums
                    ${!cell.current ? 'text-slate-300' : isToday ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200/60' : isSun ? 'text-red-500' : isSatCal ? 'text-blue-500' : 'text-slate-700'}
                  `}>
                    {cell.day}
                  </span>
                  {cell.current && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                      className="ml-auto w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="イベントを追加"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>

                <div className="mt-1 flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-col gap-1 overflow-hidden" style={{ maxHeight: eventsPanelMaxHeight }}>
                    {visibleEvents.map((ev) => {
                      const typeSty = ts(ev.type || '');
                      const captionNoDates = buildEventOptionalCaption(ev, { includeDates: false });
                      const captionFull = buildEventOptionalCaption(ev);
                      const prog = prepProgressMap[ev.id];
                      const progPct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : null;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onSelect(ev)}
                          onMouseEnter={(e) => onHover(ev, e)}
                          onMouseLeave={onHoverEnd}
                          style={{ borderLeftWidth: 3, borderLeftColor: typeSty.border, minHeight: eventRowMinHeight }}
                          aria-label={narrowViewport
                            ? (captionNoDates ? `${ev.venue}。${captionNoDates}` : ev.venue)
                            : (captionFull ? `${ev.venue}。${captionFull}` : ev.venue)
                          }
                          title={ev.status === 'completed' ? '完了済み' : undefined}
                          className="relative overflow-hidden flex w-full shrink-0 items-center gap-1.5 rounded-md border border-solid border-slate-200 bg-white px-1.5 py-0.5 text-left shadow-sm ring-1 ring-inset ring-slate-900/[0.04] transition hover:border-slate-300 hover:bg-slate-50/90"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-slate-900/20" style={{ backgroundColor: typeSty.border }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[12px] font-semibold leading-tight text-slate-900 max-xl:text-[11px]">
                            {ev.venue}
                          </span>
                          {progPct !== null && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
                              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progPct}%` }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenDayDetail({ year, month, day: cell.day, events: dayEvents })}
                        style={{ minHeight: eventRowMinHeight }}
                        className="w-full shrink-0 text-left rounded-md border border-solid border-slate-300/80 bg-slate-200/90 px-1 py-0.5 flex items-center justify-center overflow-hidden transition hover:bg-slate-300/90 hover:border-slate-400/80 text-[12px] max-xl:text-[11px] leading-none font-bold text-slate-800 shadow-sm"
                        aria-label={`あと${hiddenCount}件のイベントを表示`}
                      >
                        +{hiddenCount}件
                      </button>
                    )}
                  </div>

                  {cell.current && dayEvents.length === 0 && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                      className={`mt-auto flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 py-1 opacity-0 transition-all hover:border-indigo-300 hover:text-indigo-400 group-hover:opacity-100 text-slate-300 ${narrowViewport ? 'min-h-9' : 'min-h-[2rem]'}`}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HoverCard({ event, pos, prepStats }: {
  event: Event;
  pos: { x: number; y: number };
  prepStats?: { total: number; done: number };
}) {
  const left = pos.x + 260 > window.innerWidth ? pos.x - 270 : pos.x + 16;
  const top = pos.y + 280 > window.innerHeight ? pos.y - 260 : pos.y + 8;
  const pct = prepStats && prepStats.total > 0 ? Math.round((prepStats.done / prepStats.total) * 100) : null;

  return (
    <div
      className="fixed z-[200] w-60 bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 pointer-events-none hidden lg:block"
      style={{ left, top }}
    >
      <div className="flex items-start gap-2 mb-3">
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full border border-slate-900/15" style={{ backgroundColor: ts(event.type || '').border }} aria-hidden />
        <div className="min-w-0">
          <div className="font-black text-sm text-slate-900 leading-tight truncate">{event.venue}</div>
          <div className="text-[10px] font-bold text-slate-600 mt-0.5">{buildEventOptionalCaption(event) || (event.type || 'その他')}</div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-slate-700">
        <div className="flex gap-2">
          <span className="w-2 h-2 rounded-full mt-1 shrink-0 ring-1 ring-slate-900/10" style={{ background: rs(event.region || '').dot }} />
          <span>{event.region}</span>
        </div>
        <div className="font-mono text-slate-500">
          {event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ''}
        </div>
        {event.client && <div className="text-slate-500">{event.client}</div>}
        {event.note && <div className="text-slate-400 line-clamp-2">{event.note}</div>}
      </div>
      {prepStats && prepStats.total > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">準備物</span>
            <span className="text-[10px] font-black text-indigo-600">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-bold">{prepStats.done} / {prepStats.total} 完了</div>
        </div>
      )}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-300">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
        <Calendar size={32} />
      </div>
      <div className="text-sm font-bold text-slate-400">イベントが見つかりません</div>
    </div>
  );
}
