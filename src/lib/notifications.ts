import type { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Notification as AppNotification } from '../types';
import { Event } from '../types';

type NotificationPayload = Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'recipientUid'>;

export async function recordUserLogin(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lastLoginAt: serverTimestamp(),
  }, { merge: true });
}

export async function createNotification(data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyAllLoggedInUsers(data: NotificationPayload, actor: User): Promise<void> {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  if (usersSnapshot.empty) return;

  let batch = writeBatch(db);
  let operationCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const recipientUid = userDoc.id;
    const notificationRef = doc(collection(db, 'users', recipientUid, 'notifications'));
    batch.set(notificationRef, {
      ...data,
      recipientUid,
      actorUid: actor.uid,
      actorName: actor.displayName,
      actorEmail: actor.email,
      read: false,
      createdAt: serverTimestamp(),
    });
    operationCount += 1;

    if (operationCount === 450) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
}

export async function notifyEventCreated(event: Event, actor: User): Promise<void> {
  const actorName = actor.displayName || actor.email || '編集者';
  await notifyAllLoggedInUsers({
    type: 'event_created',
    title: 'イベント作成',
    message: `${actorName}さんが「${event.venue}」を作成しました`,
    eventId: event.id,
    userId: actor.uid,
  }, actor);
}

export async function notifyEventUpdated(event: Event, actor: User): Promise<void> {
  const actorName = actor.displayName || actor.email || '編集者';
  await notifyAllLoggedInUsers({
    type: 'event_updated',
    title: 'イベント更新',
    message: `${actorName}さんが「${event.venue}」を更新しました`,
    eventId: event.id,
    userId: actor.uid,
  }, actor);
}

export async function notifyEventDeleted(venue: string, eventId: string, actor: User): Promise<void> {
  const actorName = actor.displayName || actor.email || '編集者';
  await notifyAllLoggedInUsers({
    type: 'event_deleted',
    title: 'イベント削除',
    message: `${actorName}さんが「${venue}」を削除しました`,
    eventId,
    userId: actor.uid,
  }, actor);
}

/**
 * 新たに担当者に追加されたメンバーへ通知を送る。
 * staff.email が設定されている場合はそのアドレスで照合し、未設定の場合は displayName で照合する。
 */
export async function notifyAssigneesAdded(
  addedStaff: { name: string; email?: string }[],
  event: Event,
  actor: User,
): Promise<void> {
  if (addedStaff.length === 0) return;
  const actorName = actor.displayName || actor.email || '編集者';

  // in-app notifications（ユーザー一覧取得が必要。権限不足の場合はスキップ）
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    let ops = 0;

    for (const staff of addedStaff) {
      // email一致を優先、なければ displayName で照合
      const userDoc = (
        staff.email
          ? usersSnapshot.docs.find(d => d.data().email === staff.email && d.id !== actor.uid)
          : undefined
      ) ?? usersSnapshot.docs.find(d => d.data().displayName === staff.name && d.id !== actor.uid);

      if (!userDoc) continue;

      const ref = doc(collection(db, 'users', userDoc.id, 'notifications'));
      batch.set(ref, {
        type: 'event_updated',
        title: '担当者に追加されました',
        message: `${actorName}さんが「${event.venue}」の担当者にあなたを追加しました`,
        eventId: event.id,
        userId: actor.uid,
        recipientUid: userDoc.id,
        actorUid: actor.uid,
        actorName: actor.displayName,
        actorEmail: actor.email,
        read: false,
        createdAt: serverTimestamp(),
      });
      ops += 1;
    }

    if (ops > 0) await batch.commit();
  } catch (e) {
    console.warn('[notifications] in-app notification skipped:', e);
  }

  const targetEmails = addedStaff.filter(s => s.email).map(s => s.email as string);

  // プッシュ通知（staff.email が設定されているメンバーのみ）
  if (targetEmails.length > 0) {
    fetch('/api/notify-assignees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assigneeEmails: targetEmails,
        eventId: event.id,
        eventVenue: event.venue,
        actorName: actorName,
      }),
    }).catch(err => console.warn('[push notification] failed:', err));
  }

  // メール通知: staff.email が設定されていれば直接使用（ユーザー照合不要）
  const emailTargets = targetEmails;

  if (emailTargets.length > 0) {
    const dateLabel = event.start === event.end
      ? event.start
      : `${event.start} 〜 ${event.end}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="font-size:16px;color:#1e293b;margin-bottom:8px;">担当者に追加されました</h2>
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          ${actor.displayName || actor.email} さんがあなたをイベントの担当者に追加しました。
        </p>
        <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">
          <div style="font-size:13px;color:#64748b;margin-bottom:4px;">会場</div>
          <div style="font-size:16px;font-weight:bold;color:#1e293b;margin-bottom:12px;">${event.venue}</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:4px;">日程</div>
          <div style="font-size:14px;color:#1e293b;">${dateLabel}</div>
        </div>
        <a href="${import.meta.env.VITE_APP_URL || 'https://ivent-schedule.vercel.app'}"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">
          アプリを開く
        </a>
      </div>
    `;
    fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: emailTargets,
        subject: `【Ivent】${event.venue} の担当者に追加されました`,
        html,
      }),
    }).catch(err => console.warn('[email notification] failed:', err));
  }
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

export function getNotificationTime(createdAt: { toDate(): Date } | Date | string | null | undefined): string {
  if (!createdAt) return '';
  const date = (createdAt as { toDate?(): Date }).toDate ? (createdAt as { toDate(): Date }).toDate() : new Date(createdAt as Date | string);
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
