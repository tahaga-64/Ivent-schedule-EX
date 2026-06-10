import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// EX-schedule は ivent-schedule-EX とは別の独立した Firebase プロジェクトに
// データを保存している。以下は EX-schedule リポジトリの firebase-applet-config.json
// に公開済みの Web クライアント設定（Firebase の Web 設定値は秘匿情報ではなく、
// アクセス制御は Firestore セキュリティルールで担保される）。
// Vercel 等で環境変数が設定されていればそちらを優先し、無ければ公開設定を使う。
//
// 重要: このプロジェクトはデフォルトではない named database
// (ai-studio-...) を使うため、databaseId の指定が必須。これを誤ると
// データが一切取得できない。
const EX_SCHEDULE_CONFIG = {
  apiKey: import.meta.env.VITE_EX_SCHEDULE_API_KEY ?? 'AIzaSyBlm_kU-uonN-clZO7EtCDAT1alxa2mVhk',
  authDomain: import.meta.env.VITE_EX_SCHEDULE_AUTH_DOMAIN ?? 'gen-lang-client-0070384633.firebaseapp.com',
  projectId: import.meta.env.VITE_EX_SCHEDULE_PROJECT_ID ?? 'gen-lang-client-0070384633',
  storageBucket: import.meta.env.VITE_EX_SCHEDULE_STORAGE_BUCKET ?? 'gen-lang-client-0070384633.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_EX_SCHEDULE_MESSAGING_SENDER_ID ?? '802549538762',
  appId: import.meta.env.VITE_EX_SCHEDULE_APP_ID ?? '1:802549538762:web:fa33891040e7ed5cd57933',
};

const EX_SCHEDULE_DATABASE_ID =
  import.meta.env.VITE_EX_SCHEDULE_DATABASE_ID ?? 'ai-studio-e6c2ec46-2ca9-43b4-b057-65599668d27c';

const APP_NAME = 'ex-schedule';
const exApp =
  getApps().find(a => a.name === APP_NAME) ??
  initializeApp(EX_SCHEDULE_CONFIG, APP_NAME);
const exDb = getFirestore(exApp, EX_SCHEDULE_DATABASE_ID);

// ─── 定数（EX-schedule constants.ts から移植） ────────────────────────────────

export const INITIAL_SCHEDULE_DATA: Record<string, string[]> = {
  '青木　大芽':   ['海浜幕張','海浜幕張','〇','外販ミステリー1','待機(海浜幕張)','研修2','研修3','〇','研修4','研修5','〇','〇','研修6','研修7','〇','〇','研修8','〇','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '大石　鈴':     ['研修1','待機(海浜幕張)','〇','外販ミステリー1','海浜幕張','研修2','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','〇','〇','〇','研修8','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '大榎　快':     ['研修1','〇','〇','外販ミステリー1','〇','研修2','研修3','〇','研修4','研修5','〇','〇','研修6','研修7','〇','〇','研修8','〇','〇','〇','研修9','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '岡　智咲':     ['〇','研修2','〇','外販ミステリー1','〇','〇','研修3','〇','研修4','研修5','〇','VR','研修6','研修7','〇','◎','〇','研修8','〇','〇','研修9','〇','◎','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','◎'],
  '小野　稜介':   ['〇','研修2','〇','外販ミステリー1','〇','〇','研修3','〇','研修4','研修5','〇','VR','研修6','研修7','〇','〇','研修8','〇','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '加藤　あかり': ['待機(海浜幕張)','研修2','〇','〇','外販ミステリー1','〇','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','〇','〇','〇','研修8','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '金田　来愛':   ['〇','研修2','〇','外販ミステリー1','〇','〇','研修3','〇','研修4','研修5','〇','VR','研修6','研修7','〇','〇','〇','研修8','〇','研修9','〇','〇','◎','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '倉田　彩':     ['研修1','研修2','〇','〇','外販ミステリー1','〇','◎','研修3','研修4','研修5','〇','VR','研修6','〇','〇','研修7','◎','研修8','◎','◎','研修9','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '黒川　莉央':   ['研修1','〇','〇','外販ミステリー1','〇','研修2','研修3','〇','研修4','研修5','〇','〇','研修6','研修7','〇','◎','〇','研修8','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','◎','〇','〇'],
  '今　理香':     ['〇','研修2','〇','外販ミステリー1','〇','〇','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','〇','〇','研修8','◎','◎','〇','研修9','〇','〇','イベントメンバー選抜','イベントメンバー選抜','◎','〇','〇','〇','〇'],
  '佐々木　瑛太': ['研修1','〇','〇','外販ミステリー1','〇','研修2','研修3','〇','研修4','研修5','〇','〇','研修6','研修7','〇','◎','研修8','〇','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '田村　ゆい':   ['〇','研修2','〇','待機(鳥浜)','外販ミステリー1','〇','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','〇','〇','研修8','〇','〇','〇','研修9','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '多呂　香穂莉': ['〇','研修2','〇','鳥浜','外販ミステリー1','〇','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','◎','〇','〇','研修8','〇','研修9','〇','〇','◎','イベントメンバー選抜','イベントメンバー選抜','◎','〇','〇','〇','〇'],
  '林　政登':     ['研修1','研修2','〇','外販ミステリー1','〇','〇','研修3','〇','研修4','研修5','〇','〇','研修6','〇','◎','研修7','〇','研修8','〇','研修9','〇','◎','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '深瀬　音楓':   ['研修1','研修2','〇','外販ミステリー1','〇','〇','研修3','〇','研修4','研修5','〇','〇','研修6','研修7','〇','〇','〇','研修8','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '牧　こはる':   ['〇','研修2','〇','外販ミステリー1','〇','〇','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','〇','〇','〇','研修8','〇','〇','研修9','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','◎','◎','〇','〇'],
  '丸山　侑子':   ['研修1','研修2','〇','〇','外販ミステリー1','〇','〇','研修3','研修4','研修5','販売','販売','研修6','〇','〇','研修7','研修8','〇','〇','研修9','◎','◎','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '水野　澪那':   ['〇','研修2','〇','〇','外販ミステリー1','〇','〇','研修3','研修4','研修5','〇','〇','研修6','研修7','〇','〇','〇','研修8','〇','研修9','〇','〇','〇','イベントメンバー選抜','イベントメンバー選抜','イベントメンバー選抜','〇','〇','〇','〇'],
  '櫻井　春人':   ['未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定'],
  '高田　将人':   ['未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定','未定'],
};

export const TRAINING_LABELS: Record<string, string> = {
  '研修1':'docomo','研修2':'au','研修3':'UQ・基礎',
  '研修4':'SB','研修5':'YM・楽天','研修6':'テクニック',
  '研修7':'ロープレ・魚','研修8':'テスト','研修9':'物販',
};

export const TRAINING_LOCATIONS: Record<string, string> = {
  '研修1':'会議室8/櫻井 | 大宮 11:00-19:00',
  '研修2':'会議室6,8/高田 | 本社 10:00-15:00',
  '研修3':'研修室C/櫻井 | 大宮 11:00-19:00',
  '研修4':'研修室C/櫻井 | 本社 10:00-19:00',
  '研修5':'研修室C/櫻井 | 本社 10:00-19:00',
  '研修6':'研修室C/櫻井 | 本社 10:00-19:00',
  '研修7':'本社 10:00-19:00','研修8':'本社 10:00-19:00','研修9':'本社 10:00-19:00',
};

export const MEMBERS = Object.keys(INITIAL_SCHEDULE_DATA);

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type StatusType = 'normal' | 'request' | 'training' | 'dispatch' | 'standby' | 'event' | 'office' | 'absence' | 'other' | 'rest';

export const TYPE_LABEL: Record<StatusType, string> = {
  normal: '公休(〇)',
  request: '希望休(◎)',
  training: '研修',
  dispatch: '外出',
  standby: '待機',
  event: 'イベント',
  office: '本社出勤',
  absence: '欠勤',
  other: 'その他',
  rest: '未定',
};

export const TYPE_CLASS: Record<StatusType, string> = {
  normal: 'bg-gray-100 text-gray-700',
  request: 'bg-pink-100 text-pink-700',
  training: 'bg-purple-100 text-purple-700',
  dispatch: 'bg-orange-100 text-orange-700',
  standby: 'bg-yellow-100 text-yellow-700',
  event: 'bg-red-100 text-red-700',
  office: 'bg-emerald-100 text-emerald-700',
  absence: 'bg-zinc-700 text-white',
  other: 'bg-blue-100 text-blue-700',
  rest: 'bg-slate-800 text-slate-400',
};

export interface GoalRow {
  content: string;
  person: string;
  deadline: string;
  stars: number;
  note: string;
}

export interface MonthData {
  schedule: Record<string, { type: StatusType; detail: string }[]>;
  memos: Record<string, Record<number, string>>;
  dones: Record<string, Record<number, boolean>>;
  goals: Record<string, GoalRow[]>;
  nextPlan: Record<string, string>;
  teamGoal: string;
  overallMemo?: string;
  trainingLabels?: Record<string, string>;
  trainingLocations?: Record<string, string>;
  memberStations?: Record<string, string>;
  // 全体表示の「場所(固定表示)」「時間(固定表示)」行（日番号→値）
  dailyLocations?: Record<number, string>;
  dailyTimes?: Record<number, string>;
}

// 後方互換性のため維持
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
  schedule: Record<string, DayEntry[]>;
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

// ─── ヘルパー ────────────────────────────────────────────────────────────────

/** month は 1始まり（1月=1） */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** month は 1始まり。月の1日が何曜日か（月曜=0, 日曜=6） */
export function getStartOffset(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay();
  return (day + 6) % 7;
}

export function getType(s: string | { type: StatusType; detail: string }): StatusType {
  if (typeof s === 'object' && s !== null) return (s as { type: StatusType }).type;
  if (!s || typeof s !== 'string') return 'rest';
  if (s.startsWith('研修')) return 'training';
  if (s.includes('待機')) return 'standby';
  if (s.includes('イベント')) return 'event';
  if (s === '〇') return 'normal';
  if (s === '◎') return 'request';
  if (s === '未定') return 'rest';
  if (s.includes('海浜幕張') || s.includes('鳥浜') || s.includes('外販')) return 'dispatch';
  if (s.includes('本社')) return 'office';
  if (s.includes('欠勤')) return 'absence';
  return 'other';
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

/** 後方互換用（ScheduleViewの旧コードが使う可能性があるため維持） */
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

/** フル MonthData を取得（EX-schedule 完全移植版） */
export async function fetchMonthData(year: number, month: number): Promise<MonthData | null> {
  const monthKey = `${year}-${month}`;
  const isApril2026 = year === 2026 && month === 4;
  const isAfterApril2026 = year > 2026 || (year === 2026 && month > 4);

  try {
    const snap = await getDoc(doc(exDb, 'months', monthKey));
    const raw = snap.exists() ? snap.data() : {} as Record<string, unknown>;

    const totalDays = getDaysInMonth(year, month);
    const migratedSched: Record<string, { type: StatusType; detail: string }[]> = {};

    for (const member of MEMBERS) {
      const s = (raw.schedule as Record<string, unknown[]> | undefined)?.[member];

      if (Array.isArray(s) && s.length > 0) {
        let parsed: { type: StatusType; detail: string }[] = s.map((item: unknown) => {
          if (typeof item === 'object' && item !== null && 'type' in item) {
            return item as { type: StatusType; detail: string };
          }
          const detail = String(item ?? '');
          return { type: getType(detail), detail };
        });
        if (parsed.length < totalDays) {
          parsed = [...parsed, ...Array(totalDays - parsed.length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }))];
        } else if (parsed.length > totalDays) {
          parsed = parsed.slice(0, totalDays);
        }
        migratedSched[member] = parsed;
      } else if (isApril2026 && INITIAL_SCHEDULE_DATA[member]) {
        const initial = INITIAL_SCHEDULE_DATA[member];
        let parsed = initial.map(s => ({ type: getType(s), detail: s }));
        if (parsed.length < totalDays) {
          parsed = [...parsed, ...Array(totalDays - parsed.length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }))];
        } else if (parsed.length > totalDays) {
          parsed = parsed.slice(0, totalDays);
        }
        migratedSched[member] = parsed;
      } else {
        migratedSched[member] = Array(totalDays).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
      }
    }

    return {
      schedule: migratedSched,
      memos: ((raw.memos ?? {}) as Record<string, Record<number, string>>),
      dones: ((raw.dones ?? {}) as Record<string, Record<number, boolean>>),
      goals: ((raw.goals ?? {}) as Record<string, GoalRow[]>),
      nextPlan: ((raw.nextPlan ?? {}) as Record<string, string>),
      teamGoal: String(raw.teamGoal ?? ''),
      overallMemo: String(raw.overallMemo ?? ''),
      trainingLabels: ((raw.trainingLabels ?? (isAfterApril2026 ? {} : TRAINING_LABELS)) as Record<string, string>),
      trainingLocations: ((raw.trainingLocations ?? (isAfterApril2026 ? {} : TRAINING_LOCATIONS)) as Record<string, string>),
      memberStations: ((raw.memberStations ?? {}) as Record<string, string>),
      dailyLocations: ((raw.dailyLocations ?? {}) as Record<number, string>),
      dailyTimes: ((raw.dailyTimes ?? {}) as Record<number, string>),
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

/** MonthData の任意フィールドを部分保存 */
export async function saveMonthDataFields(year: number, month: number, updates: Partial<MonthData> & Record<string, unknown>): Promise<void> {
  const monthKey = `${year}-${month}`;
  await setDoc(doc(exDb, 'months', monthKey), updates, { merge: true });
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
