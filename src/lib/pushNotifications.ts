import { User } from 'firebase/auth';
import { auth } from './firebase';
import { needsPwaInstallForPush } from './pushDeviceSupport';

const PUSH_WORKER_URL = import.meta.env.VITE_PUSH_WORKER_URL?.replace(/\/$/, '') || '';
const WEB_PUSH_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '';

export type PushNotificationStatus =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

export type PushNotificationPayload = {
  type: string;
  title: string;
  message: string;
  eventId?: string;
  targetEmail?: string;
  data?: Record<string, unknown>;
};

export type ForegroundPushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export function isPushNotificationConfigured(): boolean {
  return !!PUSH_WORKER_URL && !!WEB_PUSH_PUBLIC_KEY;
}

function assertPushConfig() {
  if (!PUSH_WORKER_URL || !WEB_PUSH_PUBLIC_KEY) {
    throw new Error('Push通知のWorker URLまたは公開鍵が設定されていません。');
  }
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

async function getAuthHeader(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/** PWA / モバイル向け：ログイン直後に SW を登録（購読は別途 opt-in） */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationConfigured() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function getPushNotificationStatus(): Promise<PushNotificationStatus> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function enablePushNotifications(user: User): Promise<PushSubscription> {
  assertPushConfig();
  if (needsPwaInstallForPush()) {
    throw new Error('iPhoneでは「ホーム画面に追加」したアプリから開いてから通知を有効にしてください。');
  }

  const status = await getPushNotificationStatus();
  if (status === 'unsupported') {
    throw new Error('このブラウザはPush通知に対応していません。');
  }

  const permission = status === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('ブラウザの通知許可が必要です。');
  }

  const registration = await registerPushServiceWorker();
  if (!registration) {
    throw new Error('Service Worker の登録に失敗しました。');
  }

  await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
  });

  const response = await fetch(`${PUSH_WORKER_URL}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeader(user),
    },
    body: JSON.stringify({
      subscription,
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    throw new Error('Push通知の登録に失敗しました。');
  }

  return subscription;
}

export async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  if (!PUSH_WORKER_URL) return;
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const response = await fetch(`${PUSH_WORKER_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeader(currentUser),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Push通知の送信に失敗しました。');
  }
}

/** 設定済みなら送信（失敗は握りつぶす） */
export function notifyPush(payload: PushNotificationPayload): void {
  if (!isPushNotificationConfigured()) return;
  sendPushNotification(payload).catch(() => {});
}

/** SW からの postMessage（フォアグラウンド表示用） */
export async function listenForForegroundPushMessages(
  onMessage: (msg: ForegroundPushMessage) => void
): Promise<() => void> {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type !== 'push-received') return;
    const payload = event.data.payload as ForegroundPushMessage | undefined;
    if (!payload?.title) return;
    onMessage(payload);
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
