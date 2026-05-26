import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { db, app } from './firebase';

const IDB_NAME = 'fcm-config';
const IDB_STORE = 'config';
const IDB_KEY = 'firebase';

/** このデバイス固有のID（localStorage に永続化） */
function getDeviceId(): string {
  const key = 'fcm-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

/** Firebase config を IndexedDB に保存（サービスワーカーが参照できるように） */
async function persistConfigToIdb(): Promise<void> {
  try {
    const config = app.options;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(config, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // non-critical
  }
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration> {
  await persistConfigToIdb();
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  const sw = await navigator.serviceWorker.ready;
  sw.active?.postMessage({ type: 'FIREBASE_CONFIG', config: app.options });
  return reg;
}

function readVapidKey(): string | undefined {
  const key = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!key || key.includes('YOUR_')) return undefined;
  return key;
}

/** トークンをデバイスIDをキーにしてFirestoreに保存 */
async function saveToken(userId: string, token: string): Promise<void> {
  const deviceId = getDeviceId();
  // fcmTokens.{deviceId} にデバイスごとのトークンを保存（上書きなし）
  await updateDoc(doc(db, 'users', userId), {
    [`fcmTokens.${deviceId}`]: token,
    uid: userId,
  }).catch(() =>
    // ドキュメントがなければ setDoc で作成
    setDoc(doc(db, 'users', userId), {
      uid: userId,
      [`fcmTokens`]: { [deviceId]: token },
    }, { merge: true })
  );
}

export type FcmDiagStep =
  | { step: string; ok: true; detail?: string }
  | { step: string; ok: false; detail: string };

/** 詳細ログ付き登録。診断画面から呼ぶ用 */
export async function registerFcmTokenWithDiagnostics(userId: string): Promise<FcmDiagStep[]> {
  const log: FcmDiagStep[] = [];

  if (typeof window === 'undefined' || !('Notification' in window)) {
    log.push({ step: 'Notification API', ok: false, detail: 'このブラウザはNotification APIに非対応' });
    return log;
  }
  log.push({ step: 'Notification API', ok: true });

  if (!('serviceWorker' in navigator)) {
    log.push({ step: 'ServiceWorker', ok: false, detail: 'ServiceWorkerに非対応' });
    return log;
  }
  log.push({ step: 'ServiceWorker', ok: true });

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    log.push({ step: 'Firebase Messaging', ok: false, detail: 'このブラウザはFCMに非対応（iOSはPWAとして起動が必要）' });
    return log;
  }
  log.push({ step: 'Firebase Messaging', ok: true });

  const vapidKey = readVapidKey();
  if (!vapidKey) {
    log.push({ step: 'VAPID Key', ok: false, detail: 'VITE_FIREBASE_VAPID_KEY が未設定' });
    return log;
  }
  log.push({ step: 'VAPID Key', ok: true });

  const perm = Notification.permission;
  if (perm === 'denied') {
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
    const detail = isIos
      ? 'ブロック済み。【解除方法】ホーム画面のアイコンを長押し→削除→Safariで再度「ホーム画面に追加」→アイコンから起動すると許可ダイアログが再表示されます'
      : 'ブロック済み。ブラウザのアドレスバー横の🔒アイコン→通知→許可 に変更してください';
    log.push({ step: '通知許可', ok: false, detail });
    return log;
  }
  if (perm !== 'granted') {
    const result = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
    if (result !== 'granted') {
      log.push({ step: '通知許可', ok: false, detail: `許可されませんでした (${result})` });
      return log;
    }
  }
  log.push({ step: '通知許可', ok: true, detail: 'granted' });

  let swReg: ServiceWorkerRegistration;
  try {
    swReg = await getSwRegistration();
    log.push({ step: 'ServiceWorker登録', ok: true });
  } catch (e) {
    log.push({ step: 'ServiceWorker登録', ok: false, detail: String(e) });
    return log;
  }

  let token: string;
  try {
    const messaging = getMessaging(getApp());
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (!token) {
      log.push({ step: 'FCMトークン取得', ok: false, detail: 'トークンが空でした' });
      return log;
    }
    log.push({ step: 'FCMトークン取得', ok: true, detail: token.slice(0, 20) + '…' });
  } catch (e) {
    log.push({ step: 'FCMトークン取得', ok: false, detail: String(e) });
    return log;
  }

  try {
    await saveToken(userId, token);
    log.push({ step: 'Firestore保存', ok: true, detail: `デバイスID: ${getDeviceId().slice(0, 8)}…` });
  } catch (e) {
    log.push({ step: 'Firestore保存', ok: false, detail: String(e) });
  }

  return log;
}

export async function registerFcmToken(userId: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (!(await isSupported())) return;

    const vapidKey = readVapidKey();
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY が未設定');
      return;
    }

    if (Notification.permission === 'denied') return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const swReg = await getSwRegistration();
    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (token) {
      await saveToken(userId, token);
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
