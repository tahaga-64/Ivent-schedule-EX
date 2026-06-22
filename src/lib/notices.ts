import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Notice {
  id: string;
  content: string;
  date: string; // YYYY-MM-DD（表示対象日）
  createdAt?: unknown;
  createdByEmail?: string;
  createdByName?: string;
}

const COLLECTION = 'notices';

/** 指定日の連絡事項をリアルタイム購読 */
export function subscribeNoticesByDate(date: string, cb: (notices: Notice[]) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('date', '==', date));
  return onSnapshot(
    q,
    snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Notice, 'id'>) }))
        .sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return ta - tb;
        });
      cb(list);
    },
    () => cb([]),
  );
}

/** 過去（指定日より前）の連絡事項をリアルタイム購読（アーカイブ用） */
export function subscribePastNotices(beforeDate: string, cb: (notices: Notice[]) => void): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('date', '<', beforeDate),
    orderBy('date', 'desc'),
  );
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Notice, 'id'>) }))),
    () => cb([]),
  );
}

export async function addNotice(
  date: string,
  content: string,
  user: { email?: string | null; displayName?: string | null },
): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    content: content.trim(),
    date,
    createdAt: serverTimestamp(),
    createdByEmail: user.email ?? '',
    createdByName: user.displayName ?? '',
  });
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
