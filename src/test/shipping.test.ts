import { describe, it, expect } from 'vitest';
import { hasDestination, isPendingShippingItem, groupByDestination, destDotColor } from '../lib/shipping';
import type { PreparationItem } from '../types';

function item(o: Partial<PreparationItem> = {}): PreparationItem {
  return {
    id: 'i', name: '長机', quantity: 1, unitPrice: 0, amount: 0, shippingFee: 0,
    arrived: false, prepared: false, note: '', order: 0,
    arrivalDestination: '新宿', orderStatus: 'ordered', ...o,
  };
}

describe('hasDestination', () => {
  it('名前と届け先があれば true', () => {
    expect(hasDestination(item())).toBe(true);
  });
  it('届け先が空なら false', () => {
    expect(hasDestination(item({ arrivalDestination: '' }))).toBe(false);
  });
  it('名前が空なら false', () => {
    expect(hasDestination(item({ name: '  ' }))).toBe(false);
  });
  it('カスタム届け先でも true', () => {
    expect(hasDestination(item({ arrivalDestination: '長野営業所' }))).toBe(true);
  });
});

describe('isPendingShippingItem', () => {
  it('未完了なら true', () => {
    expect(isPendingShippingItem(item({ orderStatus: 'ordered' }))).toBe(true);
  });
  it('着荷(arrived→完了扱い)は false', () => {
    expect(isPendingShippingItem(item({ orderStatus: 'arrived' }))).toBe(false);
  });
  it('完了は false', () => {
    expect(isPendingShippingItem(item({ orderStatus: 'completed' }))).toBe(false);
  });
});

describe('groupByDestination', () => {
  it('届け先ごとにまとめ、新宿→長南→カスタム→未指定の順', () => {
    const groups = groupByDestination([
      item({ id: 'a', arrivalDestination: '長野営業所' }),
      item({ id: 'b', arrivalDestination: '長南' }),
      item({ id: 'c', arrivalDestination: '新宿' }),
      item({ id: 'd', arrivalDestination: '' }),
    ]);
    expect(groups.map(g => g.destination)).toEqual(['新宿', '長南', '長野営業所', '未指定']);
  });

  it('同一届け先のアイテムを集約', () => {
    const groups = groupByDestination([
      item({ id: 'a', arrivalDestination: '新宿' }),
      item({ id: 'b', arrivalDestination: '新宿' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe('destDotColor', () => {
  it('プリセット届け先は固定色', () => {
    expect(destDotColor('新宿')).toBe('#06b6d4');
    expect(destDotColor('長南')).toBe('#a855f7');
  });
  it('カスタム届け先は安定した色（同名なら常に同じ）', () => {
    expect(destDotColor('長野営業所')).toBe(destDotColor('長野営業所'));
    expect(destDotColor('長野営業所')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
