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

/** ブラウザ許可 + Push 購読の実際の状態 */
export type PushSetupState =
  | 'unsupported'
  | 'needs_pwa'
  | 'denied'
  | 'prompt'
  | 'permission_only'
  | 'subscribed';

export type PushNotificationPayload = {
  type: string;
  title: string;
  message: string;
  eventId?: string;
  targetEmail?: string;
  /** 送信元端末の Push endpoint（他端末のみに配信する） */
  excludeEndpoint?: string;
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

async function postSubscriptionToWorker(user: User, subscription: PushSubscription): Promise<void> {
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
    let message = 'Push通知の登録に失敗しました。';
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }
}

/** PWA / モバイル向け：ログイン直後に SW を登録（購読は別途 opt-in） */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationConfigured() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/push-sw.js', { scope: '/', updateViaCache: 'none' });
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

/** 通知許可と端末の Push 購読をまとめて判定 */
export async function getPushSetupState(): Promise<PushSetupState> {
  if (!isPushNotificationConfigured()) return 'unsupported';
  if (needsPwaInstallForPush()) return 'needs_pwa';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'prompt';

  const registration = await registerPushServiceWorker();
  if (!registration) return 'permission_only';
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'permission_only';
}

/** 許可済み前提で SW 購読 + Worker 登録（失敗時は1回だけ再購読） */
export async function ensurePushSubscription(user: User): Promise<PushSubscription> {
  assertPushConfig();
  if (needsPwaInstallForPush()) {
    throw new Error('iPhoneでは「ホーム画面に追加」したアプリから開いてから通知を有効にしてください。');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('ブラウザの通知許可が必要です。');
  }

  const registration = await registerPushServiceWorker();
  if (!registration) {
    throw new Error('Service Worker の登録に失敗しました。');
  }
  await navigator.serviceWorker.ready;

  const subscribeFresh = async () => registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
  });

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await subscribeFresh();
  }

  try {
    await postSubscriptionToWorker(user, subscription);
    return subscription;
  } catch {
    try {
      await subscription.unsubscribe();
    } catch { /* ignore */ }
    subscription = await subscribeFresh();
    await postSubscriptionToWorker(user, subscription);
    return subscription;
  }
}

export async function enablePushNotifications(user: User): Promise<PushSubscription> {
  assertPushConfig();
  const status = await getPushNotificationStatus();
  if (status === 'unsupported') {
    throw new Error('このブラウザはPush通知に対応していません。');
  }

  const permission = status === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('ブラウザの通知許可が必要です。');
  }

  return ensurePushSubscription(user);
}

/** 許可済みなら Worker へサイレント再登録（モバイル起動時など） */
export async function syncPushSubscriptionIfGranted(user: User): Promise<boolean> {
  if (!isPushNotificationConfigured() || needsPwaInstallForPush()) return false;
  if (Notification.permission !== 'granted') return false;
  const state = await getPushSetupState();
  if (state === 'subscribed') {
    try {
      const registration = await registerPushServiceWorker();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await postSubscriptionToWorker(user, sub);
        return true;
      }
    } catch { /* fall through to full ensure */ }
  }
  if (state !== 'permission_only' && state !== 'subscribed') return false;
  try {
    await ensurePushSubscription(user);
    return true;
  } catch (e) {
    console.warn('Push subscription sync failed:', e);
    return false;
  }
}

async function getCurrentPushEndpoint(): Promise<string | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.endpoint;
  } catch {
    return undefined;
  }
}

export async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  if (!PUSH_WORKER_URL) return;
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const excludeEndpoint = payload.excludeEndpoint ?? await getCurrentPushEndpoint();

  const response = await fetch(`${PUSH_WORKER_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await getAuthHeader(currentUser),
    },
    body: JSON.stringify({
      ...payload,
      ...(excludeEndpoint ? { excludeEndpoint } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error('Push通知の送信に失敗しました。');
  }
}

export function notifyPush(payload: PushNotificationPayload): void {
  if (!isPushNotificationConfigured()) return;
  sendPushNotification(payload).catch((e) => {
    console.warn(`[Push] 送信失敗 (${payload.type}):`, e instanceof Error ? e.message : e);
  });
}

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
