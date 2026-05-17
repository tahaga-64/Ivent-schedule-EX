import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification as AppNotification } from '../types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const valid = snap.docs.flatMap(d => {
        const data = d.data();
        if (!data['type'] || !data['title'] || !data['message']) return [];
        return [{ id: d.id, ...data } as AppNotification];
      });
      setNotifications(valid);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  }

  async function markAllAsRead(): Promise<void> {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  }

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead };
}
