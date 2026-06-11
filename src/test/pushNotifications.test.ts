import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canSendPushNotificationType } from '../lib/pushNotificationPermissions';
import { EVENT_EDITOR_EMAILS } from '../lib/permissions';

describe('push worker permission rules', () => {
  const editors = [...EVENT_EDITOR_EMAILS];

  it('event_created / event_updated / event_deleted / member_added は編集者のみ', () => {
    for (const type of ['event_created', 'event_updated', 'event_deleted', 'member_added'] as const) {
      expect(canSendPushNotificationType(type, editors[0], editors)).toBe(true);
      expect(canSendPushNotificationType(type, 'other@example.com', editors)).toBe(false);
      expect(canSendPushNotificationType(type, undefined, editors)).toBe(false);
    }
  });

  it('fish_added / photo_added / schedule_updated / prep_updated はログイン済み全員が送信可', () => {
    for (const type of ['fish_added', 'photo_added', 'schedule_updated', 'prep_updated'] as const) {
      expect(canSendPushNotificationType(type, 'anyone@example.com', editors)).toBe(true);
      expect(canSendPushNotificationType(type, editors[0], editors)).toBe(true);
    }
  });

  it('未知の type は拒否', () => {
    expect(canSendPushNotificationType('unknown_type', editors[0], editors)).toBe(false);
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
});
