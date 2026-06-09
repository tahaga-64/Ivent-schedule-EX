import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const APP_NAME = 'ex-schedule';
const exApp =
  getApps().find(a => a.name === APP_NAME) ??
  initializeApp(
    {
      apiKey: import.meta.env.VITE_EX_SCHEDULE_API_KEY,
      projectId: import.meta.env.VITE_EX_SCHEDULE_PROJECT_ID,
    },
    APP_NAME,
  );
const exDb = getFirestore(exApp, import.meta.env.VITE_EX_SCHEDULE_DATABASE_ID ?? '(default)');

export interface StaffBreakdown {
  total: number;
  office: number;
  event: number;
  dispatch: number;
  rest: number;
  request: number;
  other: number;
}

export interface DayEntry {
  type: string;
  note?: string;
}

export interface MonthSchedule {
  /** staffId/staffName → 日付インデックス(0始まり)ごとのエントリ */
  schedule: Record<string, DayEntry[]>;
  /** ドキュメントに staffNames フィールドがあれば使用 */
  staffNames?: Record<string, string>;
}

export const SHIFT_TYPES: Record<string, { label: string; bg: string; text: string; emoji: string }> = {
  office:   { label: '本社',    bg: 'rgba(99,102,241,0.28)',  text: '#a5b4fc', emoji: '🏢' },
  event:    { label: 'イベント', bg: 'rgba(16,185,129,0.28)',  text: '#6ee7b7', emoji: '🎪' },
  dispatch: { label: '外出',    bg: 'rgba(245,158,11,0.28)',  text: '#fcd34d', emoji: '🚗' },
  standby:  { label: '待機',    bg: 'rgba(245,158,11,0.20)',  text: '#fcd34d', emoji: '⏳' },
  rest:     { label: '公休',    bg: 'rgba(100,116,139,0.20)', text: '#94a3b8', emoji: '🏖' },
  normal:   { label: '公休',    bg: 'rgba(100,116,139,0.20)', text: '#94a3b8', emoji: '🏖' },
  request:  { label: '希望休',  bg: 'rgba(167,139,250,0.25)', text: '#c4b5fd', emoji: '📅' },
  absence:  { label: '欠勤',    bg: 'rgba(239,68,68,0.28)',   text: '#fca5a5', emoji: '❌' },
  training: { label: '研修',    bg: 'rgba(56,189,248,0.25)',  text: '#7dd3fc', emoji: '📚' },
};

export function shiftInfo(type: string) {
  return SHIFT_TYPES[type] ?? { label: type, bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', emoji: '—' };
}

// ─── 読み取り ────────────────────────────────────────────────────────────────

export async function fetchTodayStaffBreakdown(): Promise<StaffBreakdown | null> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const dayIndex = now.getDate() - 1;
  try {
    const snap = await getDoc(doc(exDb, 'months', monthKey));
    if (!snap.exists()) return null;
    const schedule = snap.data().schedule as Record<string, { type: string }[]> | undefined;
    if (!schedule) return null;
    let total = 0, office = 0, event = 0, dispatch = 0, rest = 0, request = 0, other = 0;
    for (const days of Object.values(schedule)) {
      const entry = days[dayIndex];
      if (!entry) continue;
      switch (entry.type) {
        case 'office':   office++;  total++; break;
        case 'event':    event++;   total++; break;
        case 'dispatch':
        case 'standby':  dispatch++; total++; break;
        case 'rest':
        case 'normal':   rest++;    break;
        case 'request':  request++; break;
        case 'absence':  break;
        default:         other++;   total++; break;
      }
    }
    return { total, office, event, dispatch, rest, request, other };
  } catch {
    return null;
  }
}

export async function fetchMonthSchedule(year: number, month: number): Promise<MonthSchedule | null> {
  const monthKey = `${year}-${month}`;
  try {
    const snap = await getDoc(doc(exDb, 'months', monthKey));
    if (!snap.exists()) return { schedule: {} };
    const data = snap.data();
    return {
      schedule: (data.schedule ?? {}) as Record<string, DayEntry[]>,
      staffNames: data.staffNames as Record<string, string> | undefined,
    };
  } catch {
    return null;
  }
}

// ─── 書き込み ────────────────────────────────────────────────────────────────

export async function saveMonthSchedule(year: number, month: number, data: MonthSchedule): Promise<void> {
  const monthKey = `${year}-${month}`;
  await setDoc(doc(exDb, 'months', monthKey), data, { merge: true });
}

export async function updateStaffDay(
  staffId: string,
  year: number,
  month: number,
  dayIndex: number,
  type: string,
): Promise<void> {
  const current = await fetchMonthSchedule(year, month);
  if (!current) return;
  const schedule = { ...current.schedule };
  const days = schedule[staffId] ? [...schedule[staffId]] : [];
  days[dayIndex] = { ...(days[dayIndex] ?? {}), type };
  schedule[staffId] = days;
  await saveMonthSchedule(year, month, { ...current, schedule });
}
