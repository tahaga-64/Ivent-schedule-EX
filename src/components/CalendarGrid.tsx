import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { CalendarEvent } from '../types/index';
import EventChip from './EventChip';

interface Props {
  year: number;
  month: number;
  events: CalendarEvent[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_HEADERS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MAX_CHIPS = 3;

function eventCoversDate(ev: CalendarEvent, year: number, month: number, day: number): boolean {
  const cell  = new Date(year, month - 1, day);
  const start = new Date(ev.start + 'T00:00:00');
  const end   = new Date(ev.end   + 'T23:59:59');
  return cell >= start && cell <= end;
}

export default function CalendarGrid({
  year, month, events,
  onPrevMonth, onNextMonth, onToday, onSelectEvent,
}: Props) {
  const today        = new Date();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth  = new Date(year, month, 0).getDate();
  const daysInPrev   = new Date(year, month - 1, 0).getDate();

  type Cell = { day: number; current: boolean };
  const cells: Cell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, current: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, current: true });
  const tail = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= tail; i++)
    cells.push({ day: i, current: false });

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-bold text-gray-800">{MONTH_NAMES[month - 1]}</h2>
          <span className="text-2xl font-bold text-gray-400">{year}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-all duration-150">
            <Filter size={13} className="text-gray-400" />
            フィルター
          </button>
          <div className="flex items-center">
            <button onClick={onPrevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-150 text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <button onClick={onToday} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-all duration-150 mx-1">
              今日
            </button>
            <button onClick={onNextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-150 text-gray-500">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-t border-l border-gray-200">
        {DAY_HEADERS.map((d, i) => (
          <div key={d} className="border-r border-b border-gray-200 py-2 px-2 bg-white">
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${
              i === 0 || i === 6 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 border-l border-gray-200 flex-1 overflow-y-auto">
        {cells.map((cell, idx) => {
          const colIdx  = idx % 7;
          const isToday = cell.current
            && today.getFullYear() === year
            && today.getMonth()    === month - 1
            && today.getDate()     === cell.day;

          const dayEvents = cell.current
            ? events.filter(ev => eventCoversDate(ev, year, month, cell.day))
            : [];
          const visible  = dayEvents.slice(0, MAX_CHIPS);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={idx}
              className={`border-r border-b border-gray-200 p-1.5 min-h-[120px] ${
                cell.current ? 'bg-white' : 'bg-gray-50/60'
              }`}
            >
              <div className="mb-1">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-600 text-white text-sm font-semibold rounded-full">
                    {cell.day}
                  </span>
                ) : (
                  <span className={`text-sm font-medium ${
                    !cell.current                ? 'text-gray-300' :
                    colIdx === 0 || colIdx === 6 ? 'text-red-400'  :
                    'text-gray-700'
                  }`}>
                    {cell.day}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {visible.map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={onSelectEvent} />
                ))}
                {overflow > 0 && (
                  <p className="text-[11px] text-gray-400 pl-1 cursor-pointer hover:text-gray-600 transition-colors">
                    +{overflow} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
