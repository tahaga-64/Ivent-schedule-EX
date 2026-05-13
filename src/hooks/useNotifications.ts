import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Notification } from '../types';
import { markNotificationAsRead } from '../lib/notifications';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearError: () => void;
}

export function useNotifications(maxNotifications: number = 50): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      // For now, we'll get all notifications. In a real app, you'd filter by userId
      orderBy('createdAt', 'desc'),
      limit(maxNotifications)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: Notification[] = [];
        snapshot.forEach(doc => {
          notifs.push({ id: doc.id, ...doc.data() } as Notification);
        });
        setNotifications(notifs);
        setIsLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Failed to load notifications:', error);
        setError('通知の読み込みに失敗しました');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [maxNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setError('通知の既読処理に失敗しました');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifications = notifications.filter(notif => !notif.read);
      
      // Update all unread notifications in parallel
      const promises = unreadNotifications.map(notif => 
        markNotificationAsRead(notif.id)
      );
      
      await Promise.all(promises);
      
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setError('通知の一括既読処理に失敗しました');
    }
  }, [notifications]);

  const unreadCount = notifications.filter(notif => !notif.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    clearError
  };
}