import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { db, app } from './firebase';

async function getSwRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  // Wait for the SW to be active before sending config
  const sw = await navigator.serviceWorker.ready;
  // Send Firebase config so the SW can initialize without hardcoded values
  sw.active?.postMessage({ type: 'FIREBASE_CONFIG', config: app.options });
  return reg;
}

function readVapidKey(): string | undefined {
  const key = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!key || key.includes('YOUR_')) return undefined;
  return key;
}

export async function registerFcmToken(userId: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (!(await isSupported())) return;

    const vapidKey = readVapidKey();
    if (!vapidKey) {
      console.warn(
        'プッシュ通知: VITE_FIREBASE_VAPID_KEY が未設定のため FCM トークンは保存されません（アプリ内通知は利用可能です）。',
      );
      return;
    }

    // Skip if already denied — don't nag the user
    if (Notification.permission === 'denied') return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const swReg = await getSwRegistration();
    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
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
