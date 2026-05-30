import { REGION_STYLE, TYPE_STYLE, DAYS_JP } from '../constants';
import { Event } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEvent(event: Partial<Event>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!event.venue || event.venue.trim().length === 0) {
    errors.push({ field: 'venue', message: '会場名は必須です' });
  }
  if (event.venue && event.venue.length > 500) {
    errors.push({ field: 'venue', message: '会場名は500文字以内にしてください' });
  }
  if (!event.start) {
    errors.push({ field: 'start', message: '開始日は必須です' });
  }
  if (event.start && event.end && event.start > event.end) {
    errors.push({ field: 'end', message: '終了日は開始日以降にしてください' });
  }
  return errors;
}

export const DOW_JP = DAYS_JP;

export const rs = (r: string) => REGION_STYLE[r] || { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", calBg: "rgba(241, 245, 249, 0.4)", calBorder: "#cbd5e1" };
export const ts = (t: string) => TYPE_STYLE[t] || { bg: "#f8fafc", border: "#64748b", text: "#1e293b", icon: "📋" };
export const fmtShort = (d: string) => { if (!d) return "—"; const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };

export function fmtDateJP(d: string): { month: number; day: number; dow: string; label: string } {
  const date = new Date(d + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = DOW_JP[date.getDay()];
  return { month, day, dow, label: `${month}月${day}日（${dow}）` };
}

export function fmtDateRange(start: string, end: string): string {
  const s = fmtDateJP(start);
  if (!end || end === start) return s.label;
  const e = fmtDateJP(end);
  const diffDays = Math.round((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000) + 1;
  return `${s.label} → ${e.month}月${e.day}日（${e.dow}）${diffDays > 1 ? ` · ${diffDays}日間` : ''}`;
}

export function daysUntil(start: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(start + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

export function statusStyle(status?: string): { label: string; bg: string; text: string; dot: string } {
  switch (status) {
    case 'in_progress': return { label: '準備中',    bg: 'bg-amber-50',   text: 'text-amber-600',  dot: '#f59e0b' };
    case 'waiting':     return { label: '入荷待ち',  bg: 'bg-blue-50',    text: 'text-blue-600',   dot: '#3b82f6' };
    case 'ready':       return { label: '準備完了',  bg: 'bg-emerald-50', text: 'text-emerald-600',dot: '#10b981' };
    case 'completed':   return { label: '終了',      bg: 'bg-orange-500', text: 'text-white',      dot: '#f97316' };
    case 'cancelled':   return { label: 'キャンセル',bg: 'bg-red-50',     text: 'text-red-500',    dot: '#ef4444' };
    default:            return { label: '予定',      bg: 'bg-slate-50',   text: 'text-slate-400',  dot: '#cbd5e1' };
  }
}

export const getDaysInRange = (start: string, end: string): string[] => {
  const days: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return days;
};

export const formatDayLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${dow}）`;
};

export function buildEventOptionalCaption(ev: Event, opts?: { includeDates?: boolean }): string {
  const includeDates = opts?.includeDates !== false;
  const parts: string[] = [];
  if (ev.type?.trim()) parts.push(ev.type.trim());
  if (includeDates && ev.start) {
    if (ev.end && ev.end !== ev.start) parts.push(`${fmtShort(ev.start)}–${fmtShort(ev.end)}`);
    else parts.push(fmtShort(ev.start));
  }
  return parts.join(" · ");
}

export function eventCoversDate(ev: Event, y: number, m: number, day: number): boolean {
  if (!ev.start) return false;
  const s = new Date(ev.start); s.setHours(0, 0, 0, 0);
  const t = new Date(y, m - 1, day);
  if (ev.end) {
    const e = new Date(ev.end); e.setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  }
  return t.getTime() === s.getTime();
}

export function buildMonthGridCells(year: number, month: number): { day: number; current: boolean }[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; current: boolean }[] = [];
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDay - i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false });
  }
  return cells;
}
