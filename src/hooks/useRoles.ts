import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UserRole = 'admin' | 'event_editor' | 'viewer';

export interface RoleEntry {
  email: string;
  displayName: string;
  role: UserRole;
  uid?: string;
}

export const SUPER_ADMIN = 'taoki0183@gmail.com';

const SEED_EDITORS: Array<{ email: string; displayName: string; role: UserRole }> = [
  { email: 'taoki0183@gmail.com', displayName: '', role: 'event_editor' },
  { email: 'haruhito3901@gmail.com', displayName: '', role: 'event_editor' },
  { email: 'm.takada.kp@gmail.com', displayName: '', role: 'event_editor' },
];

export function useRoles() {
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'userRoles'), (snap) => {
      const list: RoleEntry[] = snap.docs.map(d => ({
        email: d.id,
        displayName: '',
        ...d.data(),
      } as RoleEntry));
      setRoles(list);
      setLoaded(true);

      if (snap.empty) {
        Promise.all(
          SEED_EDITORS.map(e =>
            setDoc(doc(db, 'userRoles', e.email), {
              email: e.email,
              displayName: e.displayName,
              role: e.role,
              addedAt: serverTimestamp(),
            })
          )
        ).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  function isEventEditor(email: string | null | undefined): boolean {
    if (!email) return false;
    if (email === SUPER_ADMIN) return true;
    const entry = roles.find(r => r.email === email);
    return entry?.role === 'event_editor' || entry?.role === 'admin';
  }

  function isAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    if (email === SUPER_ADMIN) return true;
    const entry = roles.find(r => r.email === email);
    return entry?.role === 'admin';
  }

  async function addUser(email: string, displayName: string, role: UserRole): Promise<void> {
    await setDoc(doc(db, 'userRoles', email), {
      email,
      displayName,
      role,
      addedAt: serverTimestamp(),
    });
  }

  async function updateRole(email: string, role: UserRole): Promise<void> {
    await setDoc(doc(db, 'userRoles', email), { role }, { merge: true });
  }

  async function removeUser(email: string): Promise<void> {
    if (email === SUPER_ADMIN) throw new Error('スーパー管理者は削除できません');
    await deleteDoc(doc(db, 'userRoles', email));
  }

  return { roles, loaded, isEventEditor, isAdmin, addUser, updateRole, removeUser };
}
