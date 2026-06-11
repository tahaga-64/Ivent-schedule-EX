import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { DAYS_JP } from '../constants';
import { Event } from '../types';
import { rs, ts, fmtShort, buildEventOptionalCaption, buildMonthGridCells, buildEventsByDayMap, normalizeRegion } from '../lib/eventHelpers';

const MAX_EVENTS_IN_DAY_CELL = 3;
const MAX_EVENTS_IN_DAY_CELL_NARROW = 2;
const CAL_DAY_CELL_EVENTS_MAX_HEIGHT = "5.875rem";
const CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW = "8.125rem";
const CAL_DAY_CELL_EVENT_ROW_MIN_HEIGHT = "1.375rem";
const CAL_EVENT_ROW_MIN_HEIGHT_TOUCH = "36px";

interface MobileTimelineViewProps {
  events: Event[];
  onSelect: (event: Event) => void;
}

export function MobileTimelineView({ events, onSelect }: MobileTimelineViewProps) {
  const fmtGroup = (d: string) => {
    if (!d || d === "未定") return "日付未定";
    const [, m, day] = d.split("-");
    const date = new Date(d + "T00:00:00");
    const dow = ["日","月","火","水","木","金","土"][date.getDay()];
    return `${parseInt(m)}/${parseInt(day)} ${dow}`;
  };

  const grouped = useMemo(() => {
    const map: Record<string, Event[]> = {};
    events.forEach((ev) => {
      const key = ev.start || "未定";
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1);
  }, [events]);

  return (
    <div className="space-y-6 pb-2">
      {grouped.map(([date, evs]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-black text-slate-800">{fmtGroup(date)}</span>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400">{evs.length}</span>
          </div>
          <div className="space-y-2">
            {evs.map((ev) => {
              const typeSty = ts(ev.type || "");
              return (
              <button
                key={ev.id}
                onClick={() => onSelect(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                style={{ borderLeftWidth: 3, borderLeftColor: typeSty.border }}
                className="w-full border border-slate-200 bg-white rounded-2xl flex items-center gap-3 text-left shadow-sm transition-all overflow-hidden hover:bg-slate-50 active:scale-[0.99] min-h-12"
              >
                <div className="flex-1 py-4 min-w-0 px-3">
                  <div className="font-bold text-slate-900 text-sm truncate">{ev.venue}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ev.type || "その他"}
                  </div>
                </div>
                {ev.end && ev.end !== ev.start && (
                  <span className="text-[11px] text-slate-400 font-bold pr-4 shrink-0">→{fmtShort(ev.end)}</span>
                )}
              </button>
            );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface MobileWeekStripProps {
  events: Event[];
}

export function MobileWeekStrip({ events }: MobileWeekStripProps) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
  const dayLabels = DAYS_JP;

  return (
    <div className="flex justify-between gap-0.5 rounded-2xl border border-slate-200 bg-white px-1 py-2 shadow-sm">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        const hasEvent = events.some((ev) => ev.start && new Date(ev.start + 'T00:00:00').toDateString() === d.toDateString());
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 min-w-0">
            <span className={`text-[10px] font-bold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{dayLabels[i]}</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
              isToday ? "bg-indigo-600 text-white shadow-md shadow-indigo-200/60" : "text-slate-700"
            }`}>
              {d.getDate()}
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${hasEvent ? (isToday ? 'bg-indigo-600' : 'bg-indigo-400') : 'bg-transparent'}`} />
          </div>
        );
      })}
    </div>
  );
}

/** モバイル「週」: 月グリッド上の1週分（常に最大 MAX_EVENTS_IN_DAY_CELL_NARROW 件 + +N） */
interface MobileMonthWeekGridProps {
  year: number;
  month: number;
  weekRowIndex: number;
  onWeekRowChange: (idx: number) => void;
  events: Event[];
  onSelect: (ev: Event) => void;
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  onCreateEvent: (data?: Partial<Event>) => void;
}

export function MobileMonthWeekGrid({
  year,
  month,
  weekRowIndex,
  onWeekRowChange,
  events,
  onSelect,
  onOpenDayDetail,
  onCreateEvent,
}: MobileMonthWeekGridProps) {
  const cells = buildMonthGridCells(year, month);
  const weekRowCount = cells.length / 7;
  const weekSlice = cells.slice(weekRowIndex * 7, weekRowIndex * 7 + 7);
  const today = new Date();
  const eventsByDay = useMemo(
    () => buildEventsByDayMap(events, year, month),
    [events, year, month]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40"
          disabled={weekRowIndex <= 0}
          onClick={() => onWeekRowChange(Math.max(0, weekRowIndex - 1))}
          aria-label="前の週"
        >
          ‹
        </button>
        <span className="text-center text-xs font-black text-slate-700">
          {year}年{month}月 · 第{weekRowIndex + 1}/{weekRowCount}週
        </span>
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40"
          disabled={weekRowIndex >= weekRowCount - 1}
          onClick={() => onWeekRowChange(Math.min(weekRowCount - 1, weekRowIndex + 1))}
          aria-label="次の週"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekSlice.map((cell, i) => {
          const idx = weekRowIndex * 7 + i;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;
          const isToday =
            cell.current &&
            today.getFullYear() === year &&
            today.getMonth() === month - 1 &&
            today.getDate() === cell.day;
          const dayEvents = cell.current ? (eventsByDay.get(cell.day) ?? []) : [];
          const maxN = MAX_EVENTS_IN_DAY_CELL_NARROW;
          const visible = dayEvents.slice(0, maxN);
          const hiddenCount = Math.max(0, dayEvents.length - maxN);
          return (
            <div
              key={`${year}-${month}-${idx}`}
              className={`flex min-h-[8.5rem] flex-col rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm ${
                isToday ? "ring-2 ring-indigo-400/40" : ""
              }`}
            >
              <div
                className={`mb-0.5 shrink-0 border-b border-slate-100 pb-0.5 text-center ${
                  !cell.current ? "text-slate-300" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-slate-600"
                }`}
              >
                <div className="text-[9px] font-bold text-slate-400">{DAYS_JP[idx % 7]}</div>
                <div
                  className={`text-[13px] font-bold tabular-nums ${
                    cell.current && isToday ? "rounded-md bg-indigo-600 px-1 py-0.5 text-white" : ""
                  }`}
                >
                  {cell.day}
                </div>
              </div>
              <div
                className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden"
                style={{ maxHeight: CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW }}
              >
                {visible.map((ev) => {
                  const typeSty = ts(ev.type || "");
                  const captionNd = buildEventOptionalCaption(ev, { includeDates: false });
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelect(ev)}
                      title={ev.status === 'completed' ? '完了済み' : undefined}
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: typeSty.border,
                        minHeight: CAL_EVENT_ROW_MIN_HEIGHT_TOUCH,
                      }}
                      aria-label={captionNd ? `${ev.venue}。${captionNd}` : ev.venue}
                      className="flex w-full shrink-0 flex-col justify-center overflow-hidden rounded border border-slate-200 bg-white px-1 py-0.5 text-left ring-1 ring-inset ring-slate-900/[0.04] hover:bg-slate-50"
                    >
                      <span className="w-full truncate text-[11px] font-bold leading-tight text-slate-900">
                        {ev.venue}
                      </span>
                      <span className="w-full truncate text-[9px] leading-tight text-slate-400">
                        {normalizeRegion(ev.region)}{ev.type ? `・${ev.type}` : ''}
                      </span>
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    style={{ minHeight: CAL_EVENT_ROW_MIN_HEIGHT_TOUCH }}
                    onClick={() => onOpenDayDetail({ year, month, day: cell.day, events: dayEvents })}
                    className="w-full shrink-0 rounded border border-slate-300 bg-slate-200 py-1 text-center text-[10px] font-bold text-slate-800 shadow-sm"
                  >
                    +{hiddenCount}
                  </button>
                )}
                {cell.current && dayEvents.length === 0 && (
                  <button
                    type="button"
                    className="mt-auto flex min-h-9 flex-1 items-center justify-center rounded border border-dashed border-slate-200 text-slate-300"
                    onClick={() =>
                      onCreateEvent({
                        start: `${year}-${String(month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`,
                      })
                    }
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MobileDayAgendaViewProps {
  year: number;
  month: number;
  agendaDay: number;
  setAgendaDay: (d: number) => void;
  events: Event[];
  onSelect: (ev: Event) => void;
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  onCreateEvent: (data?: Partial<Event>) => void;
  canEdit: boolean;
}

export function MobileDayAgendaView({
  year,
  month,
  agendaDay,
  setAgendaDay,
  events,
  onSelect,
  onOpenDayDetail,
  onCreateEvent,
  canEdit,
}: MobileDayAgendaViewProps) {
  const dim = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(1, agendaDay), dim);
  const eventsByDay = useMemo(
    () => buildEventsByDayMap(events, year, month),
    [events, year, month]
  );
  const dayEvents = eventsByDay.get(day) ?? [];
  const dow = DAYS_JP[new Date(year, month - 1, day).getDay()];
  const maxN = MAX_EVENTS_IN_DAY_CELL_NARROW;
  const visible = dayEvents.slice(0, maxN);
  const hiddenCount = Math.max(0, dayEvents.length - maxN);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
        <button
          type="button"
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-slate-600 active:bg-slate-100 disabled:opacity-30"
          disabled={day <= 1}
          onClick={() => setAgendaDay(day - 1)}
          aria-label="前の日"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-lg font-black text-slate-900 tabular-nums">
            {month}/{day}
          </div>
          <div className="text-xs font-bold text-slate-500">{dow}曜日</div>
        </div>
        <button
          type="button"
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-slate-600 active:bg-slate-100 disabled:opacity-30"
          disabled={day >= dim}
          onClick={() => setAgendaDay(day + 1)}
          aria-label="次の日"
        >
          ›
        </button>
      </div>

      {dayEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400">
          この日のイベントはありません
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((ev) => {
            const typeSty = ts(ev.type || "");
            const meta = buildEventOptionalCaption(ev);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                style={{ borderLeftWidth: 3, borderLeftColor: typeSty.border }}
                className="flex min-h-12 w-full items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm active:scale-[0.99] transition-all hover:bg-slate-50"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-slate-200"
                  style={{ backgroundColor: typeSty.border }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900">{ev.venue}</span>
                  {meta ? (
                    <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{meta}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenDayDetail({ year, month, day, events: dayEvents })}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-sm font-bold text-slate-800 shadow-sm"
            >
              ほか +{hiddenCount}件
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <button
          type="button"
          disabled={!canEdit}
          className={`flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed text-sm font-bold transition-colors ${
            canEdit
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          }`}
          onClick={() =>
            canEdit &&
            onCreateEvent({
              start: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            })
          }
        >
          この日にイベントを追加
        </button>
        {!canEdit && (
          <p className="text-center text-[11px] text-slate-400">
            ※ 権限がありません
          </p>
        )}
      </div>
    </div>
  );
}

export { CalendarView, HoverCard, EmptyState } from './CalendarView';
