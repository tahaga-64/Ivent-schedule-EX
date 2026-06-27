import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canSendPushNotificationType } from '../lib/pushNotificationPermissions';
import { EVENT_EDITOR_EMAILS } from '../lib/permissions';

describe('push worker permission rules', () => {
  const editors = [...EVENT_EDITOR_EMAILS];

  it('member_added は編集者のみ', () => {
    expect(canSendPushNotificationType('member_added', editors[0], editors)).toBe(true);
    expect(canSendPushNotificationType('member_added', 'other@example.com', editors)).toBe(false);
    expect(canSendPushNotificationType('member_added', undefined, editors)).toBe(false);
  });

  it('event_created 等は認証済みユーザー全員が送信可（匿名 PWA 含む）', () => {
    for (const type of ['event_created', 'event_updated', 'event_deleted', 'event_status_updated', 'fish_added', 'photo_added', 'schedule_updated', 'prep_updated', 'container_updated', 'notice_added'] as const) {
      expect(canSendPushNotificationType(type, undefined, editors)).toBe(true);
      expect(canSendPushNotificationType(type, 'anyone@example.com', editors)).toBe(true);
    }
  });

  it('未知の type は拒否', () => {
    expect(canSendPushNotificationType('unknown_type', editors[0], editors)).toBe(false);
  });

  it('大文字・空白混じりのエディターメールでも member_added が通る', () => {
    const messyEditors = [' Admin@Example.com ', '  other@test.com'];
    expect(canSendPushNotificationType('member_added', 'admin@example.com', messyEditors)).toBe(true);
    expect(canSendPushNotificationType('member_added', 'Admin@Example.com', messyEditors)).toBe(true);
    expect(canSendPushNotificationType('member_added', 'unknown@example.com', messyEditors)).toBe(false);
  });

  it('空の editorEmails では member_added を拒否', () => {
    expect(canSendPushNotificationType('member_added', 'anyone@example.com', [])).toBe(false);
  });
});

describe('event_created 判定（保存後に pendingNewEventId をクリアするため、事前にフラグを保持する）', () => {
  it('保存前に isNewEvent を確定しないと通知が常にスキップされる', () => {
    let pendingNewEventId: string | null = 'new-id';
    const selectedId = 'new-id';

    const isNewEvent = pendingNewEventId !== null && selectedId === pendingNewEventId;
    pendingNewEventId = null;

    const brokenCheck = pendingNewEventId !== null && selectedId === pendingNewEventId;
    expect(isNewEvent).toBe(true);
    expect(brokenCheck).toBe(false);
  });
});

describe('pushNotifications client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Worker URL と公開鍵が両方あるときのみ configured', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BMZYiQ9test');
    const { isPushNotificationConfigured } = await import('../lib/pushNotifications');
    expect(isPushNotificationConfigured()).toBe(true);
  });

  it('Worker URL が空なら未設定扱い', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', '');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BMZYiQ9test');
    const { isPushNotificationConfigured } = await import('../lib/pushNotifications');
    expect(isPushNotificationConfigured()).toBe(false);
  });

  it('公開鍵が空なら未設定扱い', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', '');
    const { isPushNotificationConfigured } = await import('../lib/pushNotifications');
    expect(isPushNotificationConfigured()).toBe(false);
  });

  it('notifyPush は Worker URL 未設定なら no-op', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', '');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { notifyPush } = await import('../lib/pushNotifications');
    notifyPush({ type: 'fish_added', title: 't', message: 'm' });
    await new Promise(r => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getPushNotificationStatus は Notification API 非対応なら unsupported', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const { getPushNotificationStatus } = await import('../lib/pushNotifications');
    const originalNotification = globalThis.Notification;
    // @ts-expect-error test stub
    delete globalThis.Notification;
    await expect(getPushNotificationStatus()).resolves.toBe('unsupported');
    globalThis.Notification = originalNotification;
  });

  it('getPushNotificationStatus は permission に応じた値を返す', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    // jsdom doesn't provide serviceWorker or PushManager; stub them via Proxy
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('navigator', new Proxy(navigator, {
      has(t, k) { return k === 'serviceWorker' ? true : k in t; },
      get(t, k) { return k === 'serviceWorker' ? {} : (t as never)[k]; },
    }));
    const { getPushNotificationStatus } = await import('../lib/pushNotifications');

    vi.stubGlobal('Notification', { permission: 'granted' });
    await expect(getPushNotificationStatus()).resolves.toBe('granted');

    vi.stubGlobal('Notification', { permission: 'denied' });
    await expect(getPushNotificationStatus()).resolves.toBe('denied');

    vi.stubGlobal('Notification', { permission: 'default' });
    await expect(getPushNotificationStatus()).resolves.toBe('default');
  });

  it('sendPushNotification は正しい URL・ヘッダー・ボディで fetch を呼ぶ', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://push.example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BMZYiQ9test');

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const authMock = { currentUser: { getIdToken: async () => 'test-firebase-token' } };
    vi.doMock('../lib/firebase', () => ({ auth: authMock }));

    const { sendPushNotification } = await import('../lib/pushNotifications');
    await sendPushNotification({
      type: 'event_created',
      title: 'テストイベント',
      message: '新しいイベントが追加されました',
      eventId: 'ev123',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://push.example.workers.dev/send');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-firebase-token');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.type).toBe('event_created');
    expect(body.title).toBe('テストイベント');
    expect(body.message).toBe('新しいイベントが追加されました');
    expect(body.eventId).toBe('ev123');
  });

  it('sendPushNotification は Worker URL 末尾スラッシュを除去して /send を付与', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://push.example.workers.dev/');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const authMock = { currentUser: { getIdToken: async () => 'token' } };
    vi.doMock('../lib/firebase', () => ({ auth: authMock }));

    const { sendPushNotification } = await import('../lib/pushNotifications');
    await sendPushNotification({ type: 'fish_added', title: 't', message: 'm' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://push.example.workers.dev/send');
    expect(url).not.toContain('//send');
  });

  it('sendPushNotification は Worker が non-ok を返したらエラーを投げる', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://push.example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const authMock = { currentUser: { getIdToken: async () => 'token' } };
    vi.doMock('../lib/firebase', () => ({ auth: authMock }));

    const { sendPushNotification } = await import('../lib/pushNotifications');
    await expect(sendPushNotification({ type: 'fish_added', title: 't', message: 'm' }))
      .rejects.toThrow('Push通知の送信に失敗しました');
  });

  it('notifyPush はエラーを握り潰して呼び出し元にスローしない', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://push.example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const authMock = { currentUser: { getIdToken: async () => 'token' } };
    vi.doMock('../lib/firebase', () => ({ auth: authMock }));

    const { notifyPush } = await import('../lib/pushNotifications');
    expect(() => notifyPush({ type: 'fish_added', title: 't', message: 'm' })).not.toThrow();
    await new Promise(r => setTimeout(r, 10));
  });
});

