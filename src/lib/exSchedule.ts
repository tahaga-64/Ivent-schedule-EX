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

const NON_WORKING = new Set(['normal', 'request', 'rest', 'absence']);

export async function fetchTodayStaffCount(): Promise<number | null> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const dayIndex = now.getDate() - 1;
  try {
    const snap = await getDoc(doc(exDb, 'months', monthKey));
    if (!snap.exists()) return null;
    const schedule = snap.data().schedule as Record<string, { type: string }[]> | undefined;
    if (!schedule) return null;
    return Object.values(schedule).filter(days => {
      const entry = days[dayIndex];
      return entry && !NON_WORKING.has(entry.type);
    }).length;
  } catch {
    return null;
  }
}
