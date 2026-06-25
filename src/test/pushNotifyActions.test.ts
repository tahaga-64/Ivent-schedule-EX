import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PreparationItem } from '../types';

describe('pushNotifyActions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('detectPrepOrderStatusChanges finds order status diffs only', async () => {
    const { detectPrepOrderStatusChanges } = await import('../lib/pushNotifyActions');
    const previous: PreparationItem[] = [
      { id: 'a', name: '水槽', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'unordered', order: 0 },
      { id: 'b', name: ' ', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'ordered', order: 1 },
    ];
    const current: PreparationItem[] = [
      { ...previous[0], orderStatus: 'ordered' },
      { ...previous[1], orderStatus: 'shipping' },
    ];
    expect(detectPrepOrderStatusChanges(previous, current)).toEqual([
      { name: '水槽', from: 'unordered', to: 'ordered' },
    ]);
  });

  it('detectPrepOrderStatusChanges returns empty array when nothing changed', async () => {
    const { detectPrepOrderStatusChanges } = await import('../lib/pushNotifyActions');
    const items: PreparationItem[] = [
      { id: 'a', name: 'テント', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'ordered', order: 0 },
    ];
    expect(detectPrepOrderStatusChanges(items, items)).toEqual([]);
  });

  it('detectPrepOrderStatusChanges returns empty array for empty inputs', async () => {
    const { detectPrepOrderStatusChanges } = await import('../lib/pushNotifyActions');
    expect(detectPrepOrderStatusChanges([], [])).toEqual([]);
  });

  it('detectPrepOrderStatusChanges skips items with empty or whitespace-only names', async () => {
    const { detectPrepOrderStatusChanges } = await import('../lib/pushNotifyActions');
    const previous: PreparationItem[] = [
      { id: 'x', name: '', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'unordered', order: 0 },
      { id: 'y', name: '   ', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'unordered', order: 1 },
    ];
    const current: PreparationItem[] = [
      { ...previous[0], orderStatus: 'ordered' },
      { ...previous[1], orderStatus: 'ordered' },
    ];
    expect(detectPrepOrderStatusChanges(previous, current)).toEqual([]);
  });

  it('detectPrepOrderStatusChanges treats missing orderStatus as unordered', async () => {
    const { detectPrepOrderStatusChanges } = await import('../lib/pushNotifyActions');
    const previous: PreparationItem[] = [
      { id: 'a', name: 'ケーブル', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', order: 0 } as PreparationItem,
    ];
    const current: PreparationItem[] = [
      { ...previous[0], orderStatus: 'ordered' },
    ];
    expect(detectPrepOrderStatusChanges(previous, current)).toEqual([
      { name: 'ケーブル', from: 'unordered', to: 'ordered' },
    ]);
  });

  it('notifyPrepListSaved sends immediate notification for order status changes', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BMZYiQ9test');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const authMock = { currentUser: { getIdToken: async () => 'token' } };
    vi.doMock('../lib/firebase', () => ({ auth: authMock }));

    const { notifyPrepListSaved } = await import('../lib/pushNotifyActions');
    const previous: PreparationItem[] = [
      { id: 'a', name: 'ポンプ', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'unordered', order: 0 },
    ];
    const current: PreparationItem[] = [
      { ...previous[0], orderStatus: 'ordered' },
    ];
    const ref = { current: 0 };

    notifyPrepListSaved({ id: 'ev1', venue: 'テスト会場' }, previous, current, { prepItemDone: 0, prepItemTotal: 1 }, ref);
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('prep_updated');
    expect(body.title).toBe('発注状況が更新されました');
    expect(body.message).toContain('ポンプ');
    expect(body.message).toContain('未発注→発注済');
  });

  it('notifyPrepListSaved message contains "他" for multiple order changes', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyPrepListSaved } = await import('../lib/pushNotifyActions');
    const previous: PreparationItem[] = [
      { id: 'a', name: 'ポンプ', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'unordered', order: 0 },
      { id: 'b', name: 'ケーブル', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'unordered', order: 1 },
    ];
    const current: PreparationItem[] = [
      { ...previous[0], orderStatus: 'ordered' },
      { ...previous[1], orderStatus: 'ordered' },
    ];
    const ref = { current: 0 };

    notifyPrepListSaved({ id: 'ev1', venue: '会場' }, previous, current, { prepItemDone: 0, prepItemTotal: 2 }, ref);
    await new Promise(r => setTimeout(r, 0));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toContain('2件');
    expect(body.message).toContain('他');
  });

  it('notifyPrepListSaved throttles non-order-change saves within 5 minutes', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyPrepListSaved } = await import('../lib/pushNotifyActions');
    const items: PreparationItem[] = [
      { id: 'a', name: '機材', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'ordered', order: 0 },
    ];

    // Set last notify to 1 minute ago (within 5-min window)
    const ref = { current: Date.now() - 60_000 };

    notifyPrepListSaved({ id: 'ev1', venue: '会場' }, items, items, { prepItemDone: 1, prepItemTotal: 1 }, ref);
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notifyPrepListSaved sends after throttle window expires', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyPrepListSaved } = await import('../lib/pushNotifyActions');
    const items: PreparationItem[] = [
      { id: 'a', name: '機材', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0, arrived: false, prepared: false, note: '', orderStatus: 'ordered', order: 0 },
    ];

    // Set last notify to 6 minutes ago (outside 5-min window)
    const ref = { current: Date.now() - 6 * 60_000 };

    notifyPrepListSaved({ id: 'ev1', venue: '会場' }, items, items, { prepItemDone: 1, prepItemTotal: 1 }, ref);
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('prep_updated');
    expect(body.title).toBe('準備物リストが更新されました');
  });

  it('formatEventSummary joins venue, date, and region', async () => {
    const { formatEventSummary } = await import('../lib/pushNotifyActions');
    const summary = formatEventSummary({
      venue: 'ヤマダデンキ',
      start: '2026-06-06',
      region: '東日本',
    });
    expect(summary).toContain('ヤマダデンキ');
    expect(summary).toContain('2026年6月6日');
    expect(summary).toContain('東日本');
  });

  it('formatEventSummary falls back to venue when date and region are missing', async () => {
    const { formatEventSummary } = await import('../lib/pushNotifyActions');
    const summary = formatEventSummary({ venue: '幕張メッセ', start: '', region: '' });
    expect(summary).toBe('幕張メッセ');
  });

  it('formatEventSummary falls back to "イベント" when venue is also empty', async () => {
    const { formatEventSummary } = await import('../lib/pushNotifyActions');
    const summary = formatEventSummary({ venue: '', start: '', region: '' });
    expect(summary).toBe('イベント');
  });

  it('notifyEventStatusChanged sends event_status_updated with correct message', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyEventStatusChanged } = await import('../lib/pushNotifyActions');
    await notifyEventStatusChanged(
      { id: 'ev1', venue: '幕張', start: '2026-07-01', region: '東日本', status: 'in_progress' } as any,
      'completed',
    );
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('event_status_updated');
    expect(body.eventId).toBe('ev1');
    expect(body.message).toContain('幕張');
    expect(body.message).toContain('終了'); // statusStyle('completed').label
  });

  it('notifyEventStatusChanged includes venue in message for default status', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyEventStatusChanged } = await import('../lib/pushNotifyActions');
    await notifyEventStatusChanged(
      { id: 'ev2', venue: '横浜', start: '2026-07-10', region: '', status: 'scheduled' } as any,
      'scheduled',
    );
    await new Promise(r => setTimeout(r, 0));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.message).toContain('横浜');
    expect(body.message).toContain('予定'); // statusStyle('scheduled').label (default)
  });

  it('notifyContainerBoxUpdated settle kind sends correct title and message', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyContainerBoxUpdated } = await import('../lib/pushNotifyActions');
    notifyContainerBoxUpdated(
      { id: 'ev1', venue: 'テスト会場', start: '2026-07-01', region: '' },
      { kind: 'settle' },
    );
    await new Promise(r => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('container_updated');
    expect(body.title).toBe('コンテナボックス在庫精算');
    expect(body.message).toContain('在庫精算');
    expect(body.message).toContain('テスト会場');
    expect(body.eventId).toBe('ev1');
  });

  it('notifyContainerBoxUpdated save kind with counts shows item/qty info', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyContainerBoxUpdated } = await import('../lib/pushNotifyActions');
    notifyContainerBoxUpdated(
      { id: 'ev2', venue: '大阪', start: '2026-08-01', region: '西日本' },
      { kind: 'save', itemCount: 3, totalQty: 12 },
    );
    await new Promise(r => setTimeout(r, 0));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.title).toBe('コンテナボックスを更新しました');
    expect(body.message).toContain('3種類');
    expect(body.message).toContain('合計12個');
  });

  it('notifyContainerBoxUpdated save kind without counts uses fallback text', async () => {
    vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://example.workers.dev');
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));

    const { notifyContainerBoxUpdated } = await import('../lib/pushNotifyActions');
    notifyContainerBoxUpdated(
      { id: 'ev3', venue: '名古屋', start: '2026-09-01', region: '' },
      { kind: 'save' },
    );
    await new Promise(r => setTimeout(r, 0));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.title).toBe('コンテナボックスを更新しました');
    expect(body.message).toContain('備品リストを更新');
  });
});
