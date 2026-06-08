import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const APP_NAME = 'ex-schedule';
const exApp =
  getApps().find(a => a.name === APP_NAME) ??
  initializeApp(
    { apiKey: 'AIzaSyBlm_kU-uonN-clZO7EtCDAT1alxa2mVhk', projectId: 'gen-lang-client-0070384633' },
    APP_NAME,
  );
const exDb = getFirestore(exApp, 'ai-studio-e6c2ec46-2ca9-43b4-b057-65599668d27c');

export interface StaffBreakdown {
  total: number;     // 稼働合計（本社 + イベント + 外出）
  office: number;    // 本社
  event: number;     // イベント
  dispatch: number;  // 外出（dispatch / standby）
  rest: number;      // 公休
  request: number;   // 希望休
  other: number;     // その他（研修など）
}

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
        case 'office':  office++;  total++; break;
        case 'event':   event++;   total++; break;
        case 'dispatch':
        case 'standby': dispatch++; total++; break;
        case 'rest':
        case 'normal':  rest++;    break;
        case 'request': request++; break;
        case 'absence': break; // 欠勤はカウントしない
        // training / other / その他の稼働扱いステータス
        default:        other++;   total++; break;
      }
    }
    return { total, office, event, dispatch, rest, request, other };
  } catch {
    return null;
  }
}
