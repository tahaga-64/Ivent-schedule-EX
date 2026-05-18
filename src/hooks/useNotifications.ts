import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { Notification as AppNotification } from '../types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      unsubscribeNotifications?.();
      setLoading(true);

      if (!currentUser) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'users', currentUser.uid, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      unsubscribeNotifications = onSnapshot(q, snap => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
        setLoading(false);
      }, () => setLoading(false));
    });

    return () => {
      unsubscribeNotifications?.();
      unsubscribeAuth();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markAsRead(id: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    await updateDoc(doc(db, 'users', currentUser.uid, 'notifications', id), { read: true });
  }

  async function markAllAsRead(): Promise<void> {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'users', currentUser.uid, 'notifications', n.id), { read: true }));
    await batch.commit();
  }

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead };
}
