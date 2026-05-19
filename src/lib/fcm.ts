import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { db } from './firebase';

function readVapidKey(): string | undefined {
  const key = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!key || key.includes('YOUR_')) return undefined;
  return key;
}

/**
 * Web Push（FCM）用。Firebase Console > Project settings > Cloud Messaging で
 * Web Push 証明書（キーペア）を作成し、公開鍵を VITE_FIREBASE_VAPID_KEY に設定する。
 */
export async function registerFcmToken(userId: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!(await isSupported())) return;

    const vapidKey = readVapidKey();
    if (!vapidKey) {
      console.warn(
        'プッシュ通知: VITE_FIREBASE_VAPID_KEY が未設定のため FCM トークンは保存されません（アプリ内通知は利用可能です）。',
      );
      return;
    }

    const messaging = getMessaging(getApp());
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await getToken(messaging, { vapidKey });
    if (token) {
      await setDoc(
        doc(db, 'users', userId),
        { fcmToken: token, uid: userId },
        { merge: true },
      );
    }
  } catch (e) {
    console.error('FCM token registration failed:', e);
  }
}

/**
 * アプリがフォアグラウンドのときはサービスワーカー経由の通知が出ないため、
 * 受信時にブラウザの Notification API で表示する。
 */
export async function subscribeForegroundFcm(
  onNotification: (title: string, body: string) => void,
): Promise<(() => void) | undefined> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;
    if (!(await isSupported())) return undefined;
    if (!readVapidKey()) return undefined;

    const messaging = getMessaging(getApp());
    return onMessage(messaging, (payload) => {
      const n = payload.notification;
      const title = n?.title ?? String(payload.data?.title ?? '通知');
      const body = n?.body ?? String(payload.data?.body ?? '');
      onNotification(title, body);
    });
  } catch (e) {
    console.error('FCM foreground subscription failed:', e);
    return undefined;
  }
}
