import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { db } from './firebase';

export async function registerFcmToken(userId: string): Promise<void> {
  try {
    if (!('Notification' in window)) return;
    const messaging = getMessaging(getApp());
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
    if (token) {
      await setDoc(doc(db, 'users', userId), { fcmToken: token }, { merge: true });
    }
  } catch (e) {
    console.error('FCM token registration failed:', e);
  }
}
