import { REGION_STYLE, TYPE_STYLE, DAYS_JP, REGIONS, LEGACY_REGION_MAP } from '../constants';
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

export function normalizeRegion(region: string): string {
  if (!region) return '';
  if ((REGIONS as readonly string[]).includes(region)) return region;
  return LEGACY_REGION_MAP[region] ?? region;
}

export const rs = (r: string) => {
  const key = normalizeRegion(r);
  return REGION_STYLE[key] || { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", calBg: "rgba(241, 245, 249, 0.4)", calBorder: "#cbd5e1" };
};
export const ts = (t: string) => TYPE_STYLE[t] || { bg: "#f8fafc", border: "#64748b", text: "#1e293b" };
export const fmtShort = (d: string) => { if (!d) return "—"; const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };

export function fmtDateJP(d: string): { month: number; day: number; dow: string; label: string } {
  const date = new Date(d + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = DAYS_JP[date.getDay()];
  return { month, day, dow, label: `${month}月${day}日（${dow}）` };
}

/** 通知用: 2026年6月15日(日) 形式（年込み・半角括弧） */
export function fmtDateJPFull(d: string): string {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${DAYS_JP[date.getDay()]})`;
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

/** 準備物リストのイベント一覧：開始日までの日数に応じた背景色・ラベル */
export function prepEventUrgency(start: string, end: string): {
  daysLabel: string;
  rowBg: string;
  badgeCls: string;
  dateBadgeCls: string;
} {
  const today = new Date().toISOString().slice(0, 10);
  const until = daysUntil(start);
  const isOngoing = until < 0 && end >= today;

  if (isOngoing || until === 0 || (until > 0 && until <= 3)) {
    const label = isOngoing ? '開催中' : until === 0 ? '今日' : `あと${until}日`;
    return {
      daysLabel: label,
      rowBg: 'bg-red-500/15 hover:bg-red-500/20',
      badgeCls: 'bg-red-500/30 text-red-100 border-red-400/40',
      dateBadgeCls: 'bg-red-500/80',
    };
  }
  if (until > 3 && until <= 7) {
    return {
      daysLabel: `あと${until}日`,
      rowBg: 'bg-amber-500/15 hover:bg-amber-500/20',
      badgeCls: 'bg-amber-500/30 text-amber-100 border-amber-400/40',
      dateBadgeCls: 'bg-amber-500/80',
    };
  }
  return {
    daysLabel: `あと${until}日`,
    rowBg: 'bg-blue-500/15 hover:bg-blue-500/20',
    badgeCls: 'bg-blue-500/30 text-blue-100 border-blue-400/40',
    dateBadgeCls: 'bg-blue-600/80',
  };
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

/** カレンダー（暗色背景）向けステータス色 */
export function calStatusStyle(status?: string): { bg: string; hoverBg: string; border: string } {
  switch (status) {
    case 'in_progress': return { bg: 'rgba(245,158,11,0.50)', hoverBg: 'rgba(245,158,11,0.62)', border: '#fbbf24' };
    case 'waiting':     return { bg: 'rgba(59,130,246,0.50)', hoverBg: 'rgba(59,130,246,0.62)', border: '#60a5fa' };
    case 'ready':       return { bg: 'rgba(16,185,129,0.50)', hoverBg: 'rgba(16,185,129,0.62)', border: '#34d399' };
    case 'completed':   return { bg: 'rgba(100,116,139,0.42)', hoverBg: 'rgba(100,116,139,0.54)', border: '#94a3b8' };
    case 'cancelled':   return { bg: 'rgba(239,68,68,0.45)', hoverBg: 'rgba(239,68,68,0.57)', border: '#f87171' };
    default:            return { bg: 'rgba(71,85,105,0.52)', hoverBg: 'rgba(71,85,105,0.64)', border: '#94a3b8' };
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

/** 月内の日付 → イベント一覧（カレンダー用・1回の走査で構築） */
export function buildEventsByDayMap(events: Event[], year: number, month: number): Map<number, Event[]> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const map = new Map<number, Event[]>();
  for (let d = 1; d <= daysInMonth; d++) {
    map.set(d, []);
  }
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, daysInMonth);
  monthEnd.setHours(23, 59, 59, 999);

  for (const ev of events) {
    if (!ev.start) continue;
    const start = new Date(ev.start + 'T00:00:00');
    const end = ev.end ? new Date(ev.end + 'T00:00:00') : start;
    if (end < monthStart || start > monthEnd) continue;

    const from = start < monthStart ? monthStart : start;
    const to = end > monthEnd ? monthEnd : end;
    const cur = new Date(from);
    while (cur <= to) {
      map.get(cur.getDate())!.push(ev);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return map;
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
