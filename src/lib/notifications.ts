import { doc, setDoc, collection, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth, logAnalyticsEvent } from './firebase';
import { Notification } from '../types';

export function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function createNotification(
  type: Notification['type'],
  title: string,
  message: string,
  eventId?: string,
  userId?: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const notificationId = generateNotificationId();
    const notification: Omit<Notification, 'id'> = {
      type,
      title,
      message,
      eventId,
      userId: userId || auth.currentUser?.uid,
      read: false,
      createdAt: new Date().toISOString(),
      data
    };

    await setDoc(doc(db, 'notifications', notificationId), notification);
    
    logAnalyticsEvent('notification_created', {
      type,
      eventId,
      userId: userId || auth.currentUser?.uid
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await setDoc(doc(db, 'notifications', notificationId), { read: true }, { merge: true });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

export function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'event_created':
      return '🎉';
    case 'event_updated':
      return '✏️';
    case 'event_deleted':
      return '🗑️';
    case 'prep_item_updated':
      return '📦';
    case 'budget_alert':
      return '💰';
    default:
      return '🔔';
  }
}

export function getNotificationColor(type: Notification['type']): string {
  switch (type) {
    case 'event_created':
      return 'green';
    case 'event_updated':
      return 'blue';
    case 'event_deleted':
      return 'red';
    case 'prep_item_updated':
      return 'purple';
    case 'budget_alert':
      return 'orange';
    default:
      return 'gray';
  }
}

// Utility functions for creating specific notification types
export async function notifyEventCreated(eventId: string, eventTitle: string): Promise<void> {
  await createNotification(
    'event_created',
    '新しいイベントが作成されました',
    `イベント「${eventTitle}」が作成されました`,
    eventId
  );
}

export async function notifyEventUpdated(eventId: string, eventTitle: string, changes: string[]): Promise<void> {
  await createNotification(
    'event_updated',
    'イベントが更新されました',
    `イベント「${eventTitle}」の${changes.join('、')}が更新されました`,
    eventId,
    undefined,
    { changes }
  );
}

export async function notifyEventDeleted(eventTitle: string): Promise<void> {
  await createNotification(
    'event_deleted',
    'イベントが削除されました',
    `イベント「${eventTitle}」が削除されました`
  );
}

export async function notifyPrepItemUpdated(eventId: string, eventTitle: string, itemName: string): Promise<void> {
  await createNotification(
    'prep_item_updated',
    '準備アイテムが更新されました',
    `イベント「${eventTitle}」の準備アイテム「${itemName}」が更新されました`,
    eventId,
    undefined,
    { itemName }
  );
}

export async function notifyBudgetAlert(eventId: string, eventTitle: string, currentBudget: number, threshold: number): Promise<void> {
  await createNotification(
    'budget_alert',
    '予算アラート',
    `イベント「${eventTitle}」の予算が閾値（¥${threshold.toLocaleString()}）を超えました（現在: ¥${currentBudget.toLocaleString()}）`,
    eventId,
    undefined,
    { currentBudget, threshold }
  );
}

export function formatNotificationTime(timestamp: string): string {
  const now = new Date();
  const notifTime = new Date(timestamp);
  const diffMs = now.getTime() - notifTime.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  
  return notifTime.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}