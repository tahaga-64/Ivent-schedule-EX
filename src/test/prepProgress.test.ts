import { describe, it, expect } from 'vitest';
import { normalizeOrderStatus, ORDER_STATUS_LABELS } from '../lib/orderStatus';
import { computePrepProgressFields, isPrepItemCompleted, effectiveArrived } from '../lib/prepProgress';
import type { PreparationItem } from '../types';

function makeItem(overrides: Partial<PreparationItem> = {}): PreparationItem {
  return {
    id: '1',
    name: 'テスト品',
    quantity: 1,
    unitPrice: 100,
    amount: 100,
    shippingFee: 0,
    arrived: false,
    prepared: false,
    note: '',
    order: 0,
    ...overrides,
  };
}

describe('normalizeOrderStatus', () => {
  it('maps legacy statuses to new 3-step model', () => {
    expect(normalizeOrderStatus('shipping')).toBe('ordered');
    expect(normalizeOrderStatus('arrived')).toBe('completed');
    expect(normalizeOrderStatus(undefined)).toBe('unordered');
  });

  it('keeps current statuses', () => {
    expect(normalizeOrderStatus('ordered')).toBe('ordered');
    expect(normalizeOrderStatus('completed')).toBe('completed');
  });
});

describe('ORDER_STATUS_LABELS', () => {
  it('has Japanese labels for all statuses', () => {
    expect(ORDER_STATUS_LABELS.unordered).toBe('未発注');
    expect(ORDER_STATUS_LABELS.ordered).toBe('発注済み');
    expect(ORDER_STATUS_LABELS.completed).toBe('完了');
  });
});

describe('prep progress', () => {
  it('counts completed items by orderStatus', () => {
    const items = [
      makeItem({ id: 'a', orderStatus: 'unordered' }),
      makeItem({ id: 'b', orderStatus: 'ordered' }),
      makeItem({ id: 'c', orderStatus: 'completed' }),
      makeItem({ id: 'd', orderStatus: 'arrived' }),
    ];
    const progress = computePrepProgressFields(items);
    expect(progress.prepItemTotal).toBe(4);
    expect(progress.prepItemDone).toBe(2);
    expect(isPrepItemCompleted(makeItem({ orderStatus: 'completed' }))).toBe(true);
    expect(isPrepItemCompleted(makeItem({ orderStatus: 'arrived' }))).toBe(true);
    // 表示判定 effectiveArrived も 'completed'/'arrived' を完了扱い（isPrepItemCompleted と一致）
    expect(effectiveArrived(makeItem({ orderStatus: 'completed' }))).toBe(true);
    expect(effectiveArrived(makeItem({ orderStatus: 'arrived' }))).toBe(true);
    expect(effectiveArrived(makeItem({ orderStatus: 'ordered' }))).toBe(false);
  });
});
