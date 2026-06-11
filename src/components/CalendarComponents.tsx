import { useMemo, memo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DAYS_JP } from '../constants';
import { Event } from '../types';
import { rs, ts, fmtShort, buildEventOptionalCaption, buildMonthGridCells, buildEventsByDayMap, calStatusStyle, normalizeRegion } from '../lib/eventHelpers';

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
            <span className="text-sm font-black text-white/80">{fmtGroup(date)}</span>
            <div className="flex-1 h-px bg-slate-900/55" />
            <span className="text-xs font-bold text-white/40">{evs.length}</span>
          </div>
          <div className="space-y-2">
            {evs.map((ev) => {
              const statusSty = calStatusStyle(ev.status);
              return (
              <button
                key={ev.id}
                onClick={() => onSelect(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                style={{ backgroundColor: statusSty.bg, borderColor: statusSty.border }}
                className="w-full border rounded-2xl flex items-center gap-3 text-left shadow-sm transition-all overflow-hidden hover:brightness-110 active:scale-[0.99] min-h-12"
              >
                <div className="w-1 self-stretch rounded-l-2xl shrink-0" style={{ background: statusSty.border }} />
                <div className="flex-1 py-4 min-w-0">
                  <div className="font-bold text-white text-sm truncate">{ev.venue}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {ev.type || "その他"}
                  </div>
                </div>
                {ev.end && ev.end !== ev.start && (
                  <span className="text-[11px] text-white/40 font-bold pr-4 shrink-0">→{fmtShort(ev.end)}</span>
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
    <div className="flex justify-between gap-0.5 rounded-2xl border border-white/15 bg-slate-900/55 px-1 py-2">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        const hasEvent = events.some((ev) => ev.start && new Date(ev.start + 'T00:00:00').toDateString() === d.toDateString());
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 min-w-0">
            <span className={`text-[10px] font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-white/40"}`}>{dayLabels[i]}</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
              isToday ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40" : "text-white/80"
            }`}>
              {d.getDate()}
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${hasEvent ? (isToday ? 'bg-white' : 'bg-indigo-400') : 'bg-transparent'}`} />
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
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-900/55 text-lg font-bold text-white/70 disabled:opacity-40"
          disabled={weekRowIndex <= 0}
          onClick={() => onWeekRowChange(Math.max(0, weekRowIndex - 1))}
          aria-label="前の週"
        >
          ‹
        </button>
        <span className="text-center text-xs font-black text-white/80">
          {year}年{month}月 · 第{weekRowIndex + 1}/{weekRowCount}週
        </span>
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-900/55 text-lg font-bold text-white/70 disabled:opacity-40"
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
              className={`flex min-h-[8.5rem] flex-col rounded-lg border border-white/15 bg-white/[0.06] p-0.5 shadow-sm ${
                isToday ? "ring-2 ring-indigo-400/40" : ""
              }`}
            >
              <div
                className={`mb-0.5 shrink-0 border-b border-white/10 pb-0.5 text-center ${
                  !cell.current ? "text-white/25" : isSun ? "text-red-400" : isSat ? "text-blue-400" : "text-white/70"
                }`}
              >
                <div className="text-[9px] font-bold text-white/40">{DAYS_JP[idx % 7]}</div>
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
                  const statusSty = calStatusStyle(ev.status);
                  const captionNd = buildEventOptionalCaption(ev, { includeDates: false });
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelect(ev)}
                      title={ev.status === 'completed' ? '完了済み' : undefined}
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: statusSty.border,
                        backgroundColor: statusSty.bg,
                        minHeight: CAL_EVENT_ROW_MIN_HEIGHT_TOUCH,
                      }}
                      aria-label={captionNd ? `${ev.venue}。${captionNd}` : ev.venue}
                      className="flex w-full shrink-0 flex-col justify-center overflow-hidden rounded border border-white/20 px-1 py-0.5 text-left ring-1 ring-inset ring-white/10 hover:brightness-110"
                    >
                      <span className="w-full truncate text-[11px] font-bold leading-tight text-white">
                        {ev.venue}
                      </span>
                      <span className="w-full truncate text-[9px] leading-tight text-white/50">
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
                    className="w-full shrink-0 rounded border border-white/15 bg-slate-600/40 py-1 text-center text-[10px] font-bold text-white shadow-sm"
                  >
                    +{hiddenCount}
                  </button>
                )}
                {cell.current && dayEvents.length === 0 && (
                  <button
                    type="button"
                    className="mt-auto flex min-h-9 flex-1 items-center justify-center rounded border border-dashed border-white/15 text-white/25"
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
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-slate-900/55 px-2 py-1.5">
        <button
          type="button"
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white/80 active:bg-white/10 disabled:opacity-30"
          disabled={day <= 1}
          onClick={() => setAgendaDay(day - 1)}
          aria-label="前の日"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-lg font-black text-white tabular-nums">
            {month}/{day}
          </div>
          <div className="text-xs font-bold text-white/50">{dow}曜日</div>
        </div>
        <button
          type="button"
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white/80 active:bg-white/10 disabled:opacity-30"
          disabled={day >= dim}
          onClick={() => setAgendaDay(day + 1)}
          aria-label="次の日"
        >
          ›
        </button>
      </div>

      {dayEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm font-bold text-white/40">
          この日のイベントはありません
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((ev) => {
            const typeSty = ts(ev.type || "");
            const statusSty = calStatusStyle(ev.status);
            const meta = buildEventOptionalCaption(ev);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                style={{ borderLeftWidth: 3, borderLeftColor: statusSty.border, backgroundColor: statusSty.bg }}
                className="flex min-h-12 w-full items-start gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-left shadow-sm ring-1 ring-inset ring-white/10 hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-white/20"
                  style={{ backgroundColor: typeSty.border }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-white">{ev.venue}</span>
                  {meta ? (
                    <span className="mt-0.5 block truncate text-xs font-medium text-white/60">{meta}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenDayDetail({ year, month, day, events: dayEvents })}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-slate-600/40 text-sm font-bold text-white shadow-sm"
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
              ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-200'
              : 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
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
          <p className="text-center text-[11px] text-white/40">
            ※ 権限がありません
          </p>
        )}
      </div>
    </div>
  );
}

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
  /** 「+N件」押下時: その日の全イベントを渡して詳細導線（モーダル等）を開く */
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  narrowViewport: boolean;
  densityPreview?: boolean;
  prepProgressMap?: Record<string, { total: number; done: number }>;
}

function CalendarViewInner({ events, year, month, setYear, setMonth, onSelect, onHover, onHoverEnd, onCreateEvent, onOpenDayDetail, narrowViewport, densityPreview, prepProgressMap = {} }: CalendarViewProps) {
  const cells = buildMonthGridCells(year, month);
  const eventsByDay = useMemo(
    () => buildEventsByDayMap(events, year, month),
    [events, year, month]
  );

  const maxEventsInCell = narrowViewport ? MAX_EVENTS_IN_DAY_CELL_NARROW : MAX_EVENTS_IN_DAY_CELL;
  const eventRowMinHeight = narrowViewport ? CAL_EVENT_ROW_MIN_HEIGHT_TOUCH : CAL_DAY_CELL_EVENT_ROW_MIN_HEIGHT;
  const eventsPanelMaxHeight = narrowViewport ? CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW : CAL_DAY_CELL_EVENTS_MAX_HEIGHT;

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const setToday = () => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); };

  const today = new Date();
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekRows = cells.length / 7;
  const isSixWeekMonth = weekRows >= 6;

  return (
    <div className="flex flex-col h-full">
      {densityPreview && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold leading-snug text-amber-900">
          開発プレビュー: URL に <code className="rounded bg-white/80 px-1">?calPreview=density</code> を付けた状態です。月内の同一週に「0件 / 2件 / 4件 / 6件」のサンプル行が並びます（狭い画面では最大{MAX_EVENTS_IN_DAY_CELL_NARROW}件、それ以外は最大{MAX_EVENTS_IN_DAY_CELL}件まで表示し、残りは「+N件」から一覧を開けます。リロードで解除）。
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-white tracking-tight">
            {monthNames[month]} <span className="text-white/40 font-bold ml-1">{year}</span>
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-2 text-white/50 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
            <button onClick={setToday} className="px-4 py-1.5 bg-slate-900/55 border border-white/15 rounded-lg text-xs font-bold text-white/80 hover:bg-white/20 transition-colors shadow-sm ml-1 mr-1">今日</button>
            <button onClick={nextMonth} className="p-2 text-white/50 hover:text-white transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      <div
        className="flex-1 grid min-h-0 grid-cols-7 border-t border-l border-white/10"
        style={{
          gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))`,
        }}
      >
        {DAYS_JP.map((d, i) => (
          <div key={d} className="border-r border-b border-white/10 bg-white/5 py-2 px-3">
            <span className={`text-[9px] font-black tracking-widest ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-white/40"}`}>{d}</span>
          </div>
        ))}

        {cells.map((cell, idx) => {
          const isSun = idx % 7 === 0;
          const isSatCal = idx % 7 === 6;
          const isToday = cell.current && today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === cell.day;
          const dayEvents = cell.current ? (eventsByDay.get(cell.day) ?? []) : [];
          const visibleEvents = dayEvents.slice(0, maxEventsInCell);
          const hiddenCount = Math.max(0, dayEvents.length - maxEventsInCell);

          return (
            <div
              key={idx}
              className={`
                group relative flex h-full min-h-0 flex-col overflow-hidden border-r border-b border-white/10 px-1 pb-1.5 pt-1.5
                ${cell.current ? "bg-white/[0.06]" : "bg-white/[0.02]"}
                ${isSixWeekMonth
                  ? "min-h-[104px] sm:min-h-[112px] md:min-h-[118px] lg:min-h-[122px] xl:min-h-[128px] 2xl:min-h-[136px]"
                  : "min-h-[128px] sm:min-h-[136px] md:min-h-[144px] lg:min-h-[152px] xl:min-h-[160px]"}
              `}
            >
              {/* 今日・祝日・選択日などの装飾は背景レイヤに分離（テキスト／イベント領域の高さを圧迫しない）。祝日・選択日の色帯も同 div 内に載せる */}
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                {cell.current && isToday && (
                  <div className="absolute inset-0 bg-indigo-500/15 ring-1 ring-inset ring-indigo-400/30" />
                )}
              </div>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex h-7 shrink-0 items-center border-b border-white/10 px-0.5">
                  <span
                    className={`
                      inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md text-[13px] font-bold tabular-nums
                      ${!cell.current ? "text-white/25" : isToday ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/40" : isSun ? "text-red-400" : isSatCal ? "text-blue-400" : "text-white/80"}
                    `}
                  >
                    {cell.day}
                  </span>
                  {cell.current && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                      className="ml-auto w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-indigo-300 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="イベントを追加"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>

                <div className="mt-1 flex min-h-0 flex-1 flex-col">
                  <div
                    className="flex min-h-0 flex-col gap-1 overflow-hidden"
                    style={{ maxHeight: eventsPanelMaxHeight }}
                  >
                    {visibleEvents.map((ev) => {
                      const typeSty = ts(ev.type || "");
                      const statusSty = calStatusStyle(ev.status);
                      const captionNoDates = buildEventOptionalCaption(ev, { includeDates: false });
                      const captionFull = buildEventOptionalCaption(ev);
                      return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelect(ev)}
                        onMouseEnter={(e) => onHover(ev, e)}
                        onMouseLeave={onHoverEnd}
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: statusSty.border,
                          backgroundColor: statusSty.bg,
                          minHeight: eventRowMinHeight,
                        }}
                        aria-label={
                          narrowViewport
                            ? (captionNoDates ? `${ev.venue}。${captionNoDates}` : ev.venue)
                            : (captionFull ? `${ev.venue}。${captionFull}` : ev.venue)
                        }
                        title={ev.status === 'completed' ? '完了済み' : undefined}
                        className="relative overflow-hidden flex w-full shrink-0 items-center gap-1.5 rounded-md border border-solid border-white/20 px-1.5 py-0.5 text-left shadow-sm ring-1 ring-inset ring-white/10 transition hover:brightness-110"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: typeSty.border }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[12px] font-semibold leading-tight text-white max-xl:text-[11px]">
                          {ev.venue}
                        </span>
                        {/* 準備物進捗バー */}
                        {(() => {
                          const prog = prepProgressMap[ev.id];
                          if (!prog || prog.total === 0) return null;
                          const pct = Math.round((prog.done / prog.total) * 100);
                          return (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-900/55">
                              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          );
                        })()}
                      </button>
                    );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDayDetail({
                            year,
                            month,
                            day: cell.day,
                            events: dayEvents,
                          })
                        }
                        style={{ minHeight: eventRowMinHeight }}
                        className="w-full shrink-0 text-left rounded-md border border-solid border-white/15 bg-slate-600/40 px-1 py-0.5 flex items-center justify-center overflow-hidden transition hover:bg-slate-600/50 hover:border-white/25 text-[12px] max-xl:text-[11px] leading-none font-bold text-white shadow-sm ring-1 ring-inset ring-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1"
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
                      className={`mt-auto flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/15 py-1 opacity-0 transition-all hover:border-indigo-300 hover:text-indigo-300 group-hover:opacity-100 text-white/25 ${
                        narrowViewport ? "min-h-9" : "min-h-[2rem]"
                      }`}
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

export const CalendarView = memo(CalendarViewInner);

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
      className="fixed z-[200] w-60 bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl p-4 pointer-events-none hidden md:block"
      style={{ left, top }}
    >
      <div className="flex items-start gap-2 mb-3">
        <span
          className="mt-0.5 h-2 w-2 shrink-0 rounded-full border border-white/20"
          style={{ backgroundColor: ts(event.type || "").border }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="font-black text-sm text-white leading-tight truncate">{event.venue}</div>
          <div className="text-[10px] font-bold text-white/60 mt-0.5">{buildEventOptionalCaption(event) || (event.type || "その他")}</div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-white/70">
        <div className="flex gap-2">
          <span className="w-2 h-2 rounded-full mt-1 shrink-0 ring-1 ring-white/15" style={{ background: rs(event.region || '').dot }} />
          <span>{normalizeRegion(event.region)}</span>
        </div>
        <div className="font-mono text-white/50">
          {event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ''}
        </div>
        {event.client && <div className="text-white/50">{event.client}</div>}
        {event.note && <div className="text-white/40 line-clamp-2">{event.note}</div>}
      </div>
      {prepStats && prepStats.total > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">準備物</span>
            <span className="text-[10px] font-black text-indigo-300">{pct}%</span>
          </div>
          <div className="w-full bg-slate-900/55 rounded-full h-1.5">
            <div
              className="bg-indigo-400 h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-white/40 font-bold">
            {prepStats.done} / {prepStats.total} 完了
          </div>
        </div>
      )}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-white/30">
      <div className="w-20 h-20 rounded-full bg-slate-900/55 flex items-center justify-center mb-6">
        <Calendar size={32} />
      </div>
      <div className="text-sm font-bold text-white/40">イベントが見つかりません</div>
    </div>
  );
}
