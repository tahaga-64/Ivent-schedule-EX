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
});
