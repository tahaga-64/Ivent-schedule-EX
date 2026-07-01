import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from 'firebase/auth';

// ── Push 購読ライフサイクル（ensurePushSubscription / getPushSetupState /
//    syncPushSubscriptionIfGranted / listenForForegroundPushMessages）のテスト ──
//
// Service Worker / PushManager / Notification は jsdom に無いため、各テストで
// グローバルをスタブする。needsPwaInstallForPush は pushDeviceSupport をモックして制御。

const fakeUser = { getIdToken: vi.fn(async () => 'firebase-token') } as unknown as User;

// pushDeviceSupport を差し替え、PWA 判定を制御できるようにする
const needsPwaMock = vi.fn(() => false);
vi.mock('../lib/pushDeviceSupport', () => ({
  needsPwaInstallForPush: () => needsPwaMock(),
}));

// firebase auth スタブ
vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'firebase-token' } },
}));

type SubStub = { endpoint: string; unsubscribe: ReturnType<typeof vi.fn> };

/** navigator.serviceWorker / PushManager / Notification をまとめてセットアップ */
function setupPushEnv(opts: {
  permission?: NotificationPermission;
  existingSub?: SubStub | null;
  freshSub?: SubStub;
  requestPermissionResult?: NotificationPermission;
  registerImpl?: ReturnType<typeof vi.fn>;
} = {}) {
  const { permission = 'granted', existingSub = null, freshSub, requestPermissionResult, registerImpl } = opts;

  const newSub: SubStub = freshSub ?? { endpoint: 'https://push/fresh', unsubscribe: vi.fn() };

  const pushManager = {
    getSubscription: vi.fn(async () => existingSub),
    subscribe: vi.fn(async () => newSub),
  };
  const registration = { pushManager };

  const serviceWorker = {
    register: registerImpl ?? vi.fn(async () => registration),
    ready: Promise.resolve(registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal('navigator', new Proxy(navigator, {
    has(t, k) {
      if (k === 'serviceWorker') return true;
      return k in t;
    },
    get(t, k) {
      if (k === 'serviceWorker') return serviceWorker;
      if (k === 'userAgent') return 'test-agent';
      return (t as never)[k];
    },
  }));
  vi.stubGlobal('PushManager', class {});
  // 実ブラウザでは requestPermission() の解決後に Notification.permission 自体も更新されるため再現する
  const notificationStub: { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> } = {
    permission,
    requestPermission: vi.fn(async () => {
      notificationStub.permission = requestPermissionResult ?? permission;
      return notificationStub.permission;
    }),
  };
  const requestPermission = notificationStub.requestPermission;
  vi.stubGlobal('Notification', notificationStub);
  vi.stubGlobal('window', { ...globalThis, atob: (s: string) => Buffer.from(s, 'base64').toString('binary'), PushManager: class {}, Notification: notificationStub });

  return { registration, pushManager, serviceWorker, newSub, requestPermission };
}

beforeEach(() => {
  vi.resetModules();
  needsPwaMock.mockReturnValue(false);
  vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://push.example.workers.dev');
  vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BMZYiQ9test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('ensurePushSubscription', () => {
  it('iPhone 非PWA なら案内エラーを投げる', async () => {
    needsPwaMock.mockReturnValue(true);
    setupPushEnv();
    const { ensurePushSubscription } = await import('../lib/pushNotifications');
    await expect(ensurePushSubscription(fakeUser)).rejects.toThrow('ホーム画面に追加');
  });

  it('通知未許可ならエラーを投げる', async () => {
    setupPushEnv({ permission: 'default' });
    const { ensurePushSubscription } = await import('../lib/pushNotifications');
    await expect(ensurePushSubscription(fakeUser)).rejects.toThrow('通知許可が必要');
  });

  it('既存購読が無ければ新規購読して Worker に登録する', async () => {
    const { pushManager } = setupPushEnv({ existingSub: null });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { ensurePushSubscription } = await import('../lib/pushNotifications');
    const sub = await ensurePushSubscription(fakeUser);

    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(sub.endpoint).toBe('https://push/fresh');
    // /subscribe へ POST
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://push.example.workers.dev/subscribe');
  });

  it('既存購読があれば再購読せずそのまま登録する', async () => {
    const existing: SubStub = { endpoint: 'https://push/existing', unsubscribe: vi.fn() };
    const { pushManager } = setupPushEnv({ existingSub: existing });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const { ensurePushSubscription } = await import('../lib/pushNotifications');
    const sub = await ensurePushSubscription(fakeUser);

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(sub.endpoint).toBe('https://push/existing');
  });

  it('Worker 登録が初回失敗したら unsubscribe → 再購読してリトライする', async () => {
    const existing: SubStub = { endpoint: 'https://push/existing', unsubscribe: vi.fn() };
    const { pushManager } = setupPushEnv({ existingSub: existing });
    // 1回目の /subscribe は失敗、2回目は成功
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'stale' }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { ensurePushSubscription } = await import('../lib/pushNotifications');
    const sub = await ensurePushSubscription(fakeUser);

    expect(existing.unsubscribe).toHaveBeenCalledTimes(1);
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1); // リトライ時の再購読
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sub.endpoint).toBe('https://push/fresh');
  });
});

describe('getPushSetupState', () => {
  it('iPhone 非PWA なら needs_pwa', async () => {
    needsPwaMock.mockReturnValue(true);
    setupPushEnv();
    const { getPushSetupState } = await import('../lib/pushNotifications');
    expect(await getPushSetupState()).toBe('needs_pwa');
  });

  it('通知 denied なら denied', async () => {
    setupPushEnv({ permission: 'denied' });
    const { getPushSetupState } = await import('../lib/pushNotifications');
    expect(await getPushSetupState()).toBe('denied');
  });

  it('通知 default なら prompt', async () => {
    setupPushEnv({ permission: 'default' });
    const { getPushSetupState } = await import('../lib/pushNotifications');
    expect(await getPushSetupState()).toBe('prompt');
  });

  it('許可済み＋購読済みなら subscribed', async () => {
    setupPushEnv({ permission: 'granted', existingSub: { endpoint: 'https://push/x', unsubscribe: vi.fn() } });
    const { getPushSetupState } = await import('../lib/pushNotifications');
    expect(await getPushSetupState()).toBe('subscribed');
  });

  it('許可済みだが未購読なら permission_only', async () => {
    setupPushEnv({ permission: 'granted', existingSub: null });
    const { getPushSetupState } = await import('../lib/pushNotifications');
    expect(await getPushSetupState()).toBe('permission_only');
  });
});

describe('syncPushSubscriptionIfGranted', () => {
  it('未許可なら何もせず false', async () => {
    setupPushEnv({ permission: 'default' });
    const { syncPushSubscriptionIfGranted } = await import('../lib/pushNotifications');
    expect(await syncPushSubscriptionIfGranted(fakeUser)).toBe(false);
  });

  it('購読済みなら Worker に再登録して true', async () => {
    setupPushEnv({ permission: 'granted', existingSub: { endpoint: 'https://push/x', unsubscribe: vi.fn() } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { syncPushSubscriptionIfGranted } = await import('../lib/pushNotifications');
    expect(await syncPushSubscriptionIfGranted(fakeUser)).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toContain('/subscribe');
  });
});

describe('listenForForegroundPushMessages', () => {
  it('push-received メッセージを onMessage に渡し、解除関数を返す', async () => {
    const { serviceWorker } = setupPushEnv();
    const { listenForForegroundPushMessages } = await import('../lib/pushNotifications');

    const onMessage = vi.fn();
    const unsubscribe = await listenForForegroundPushMessages(onMessage);

    expect(serviceWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    const handler = serviceWorker.addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;

    // 正しい push-received は通知される
    handler({ data: { type: 'push-received', payload: { title: 'T', body: 'B' } } } as MessageEvent);
    expect(onMessage).toHaveBeenCalledWith({ title: 'T', body: 'B' });

    // 別 type は無視
    handler({ data: { type: 'other' } } as MessageEvent);
    // title 欠落は無視
    handler({ data: { type: 'push-received', payload: { body: 'no title' } } } as MessageEvent);
    expect(onMessage).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith('message', handler);
  });
});

describe('registerPushServiceWorker', () => {
  it('Push未設定なら register を呼ばず null を返す', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', '');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', '');
    const { serviceWorker } = setupPushEnv();
    const { registerPushServiceWorker } = await import('../lib/pushNotifications');

    await expect(registerPushServiceWorker()).resolves.toBeNull();
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('serviceWorker 非対応ブラウザなら null を返す', async () => {
    // setupPushEnv を呼ばない = jsdom のデフォルト（serviceWorker 無し）のまま
    const { registerPushServiceWorker } = await import('../lib/pushNotifications');
    await expect(registerPushServiceWorker()).resolves.toBeNull();
  });

  it('register が成功すれば registration を返す', async () => {
    const { registration, serviceWorker } = setupPushEnv();
    const { registerPushServiceWorker } = await import('../lib/pushNotifications');

    await expect(registerPushServiceWorker()).resolves.toBe(registration);
    expect(serviceWorker.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/', updateViaCache: 'none' });
  });

  it('register が例外を投げたら握り潰して null を返す', async () => {
    const registerImpl = vi.fn().mockRejectedValue(new Error('register failed'));
    setupPushEnv({ registerImpl });
    const { registerPushServiceWorker } = await import('../lib/pushNotifications');

    await expect(registerPushServiceWorker()).resolves.toBeNull();
    expect(registerImpl).toHaveBeenCalledTimes(1);
  });
});

describe('enablePushNotifications', () => {
  it('Push未設定なら例外を投げる', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', '');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', '');
    const { enablePushNotifications } = await import('../lib/pushNotifications');

    await expect(enablePushNotifications(fakeUser)).rejects.toThrow('設定されていません');
  });

  it('ブラウザが Push通知に非対応なら例外を投げる', async () => {
    // setupPushEnv を呼ばない = serviceWorker/PushManager/Notification が無い状態
    const { enablePushNotifications } = await import('../lib/pushNotifications');

    await expect(enablePushNotifications(fakeUser)).rejects.toThrow('対応していません');
  });

  it('通知許可を求めて拒否されたら例外を投げる', async () => {
    const { requestPermission } = setupPushEnv({ permission: 'default', requestPermissionResult: 'denied' });
    const { enablePushNotifications } = await import('../lib/pushNotifications');

    await expect(enablePushNotifications(fakeUser)).rejects.toThrow('通知許可が必要');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('既に許可済みなら requestPermission を呼ばずに購読まで完了する', async () => {
    const { requestPermission, pushManager } = setupPushEnv({ permission: 'granted', existingSub: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { enablePushNotifications } = await import('../lib/pushNotifications');

    const sub = await enablePushNotifications(fakeUser);

    expect(requestPermission).not.toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(sub.endpoint).toBe('https://push/fresh');
  });

  it('未許可（default）から許可を得たら購読まで完了する', async () => {
    const { requestPermission, pushManager } = setupPushEnv({
      permission: 'default',
      requestPermissionResult: 'granted',
      existingSub: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { enablePushNotifications } = await import('../lib/pushNotifications');

    const sub = await enablePushNotifications(fakeUser);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(sub.endpoint).toBe('https://push/fresh');
  });
});
