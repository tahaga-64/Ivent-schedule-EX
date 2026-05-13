import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Notification as AppNotification } from '../types';
import { Event } from '../types';

export async function createNotification(data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyEventCreated(event: Event, userId?: string): Promise<void> {
  await createNotification({
    type: 'event_created',
    title: 'イベント作成',
    message: `「${event.venue}」が作成されました`,
    eventId: event.id,
    userId,
  });
}

export async function notifyEventUpdated(event: Event, userId?: string): Promise<void> {
  await createNotification({
    type: 'event_updated',
    title: 'イベント更新',
    message: `「${event.venue}」が更新されました`,
    eventId: event.id,
    userId,
  });
}

export async function notifyEventDeleted(venue: string, eventId: string, userId?: string): Promise<void> {
  await createNotification({
    type: 'event_deleted',
    title: 'イベント削除',
    message: `「${venue}」が削除されました`,
    eventId,
    userId,
  });
}

export function getNotificationIcon(type: AppNotification['type']): string {
  const icons: Record<AppNotification['type'], string> = {
    event_created: '✨',
    event_updated: '✏️',
    event_deleted: '🗑️',
    prep_item_updated: '📦',
    budget_alert: '⚠️',
  };
  return icons[type] || '🔔';
}

export function getNotificationColor(type: AppNotification['type']): string {
  const colors: Record<AppNotification['type'], string> = {
    event_created: 'bg-emerald-100 text-emerald-700',
    event_updated: 'bg-indigo-100 text-indigo-700',
    event_deleted: 'bg-red-100 text-red-700',
    prep_item_updated: 'bg-amber-100 text-amber-700',
    budget_alert: 'bg-orange-100 text-orange-700',
  };
  return colors[type] || 'bg-slate-100 text-slate-700';
}

export function getNotificationTime(createdAt: any): string {
  if (!createdAt) return '';
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}
