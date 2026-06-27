import { describe, it, expect } from 'vitest';
import { isUnarrivedShinjukuItem } from '../lib/undelivered';
import type { PreparationItem } from '../types';

type ArrivalFields = Pick<PreparationItem, 'name' | 'arrivalDestination' | 'orderStatus' | 'arrivalDate'>;

const TODAY = '2026-06-27';

function item(overrides: Partial<ArrivalFields> = {}): ArrivalFields {
  return {
    name: '長机',
    arrivalDestination: '新宿',
    orderStatus: 'ordered',
    arrivalDate: '2026-06-20', // 予定日を過ぎている
    ...overrides,
  };
}

describe('isUnarrivedShinjukuItem', () => {
  it('新宿着・到着予定日が過去・未着なら対象', () => {
    expect(isUnarrivedShinjukuItem(item(), TODAY)).toBe(true);
  });

  it('到着予定日が当日でも対象（<= today）', () => {
    expect(isUnarrivedShinjukuItem(item({ arrivalDate: TODAY }), TODAY)).toBe(true);
  });

  it('未発注でも予定日を過ぎていれば対象（全て表示）', () => {
    expect(isUnarrivedShinjukuItem(item({ orderStatus: 'unordered' }), TODAY)).toBe(true);
  });

  it('配送中（shipping）も対象', () => {
    expect(isUnarrivedShinjukuItem(item({ orderStatus: 'shipping' }), TODAY)).toBe(true);
  });

  it('着荷（arrived→完了扱い）は対象外', () => {
    expect(isUnarrivedShinjukuItem(item({ orderStatus: 'arrived' }), TODAY)).toBe(false);
  });

  it('完了（completed）は対象外', () => {
    expect(isUnarrivedShinjukuItem(item({ orderStatus: 'completed' }), TODAY)).toBe(false);
  });

  it('到着予定日が未来なら対象外', () => {
    expect(isUnarrivedShinjukuItem(item({ arrivalDate: '2026-07-01' }), TODAY)).toBe(false);
  });

  it('到着予定日が未設定なら対象外', () => {
    expect(isUnarrivedShinjukuItem(item({ arrivalDate: undefined }), TODAY)).toBe(false);
  });

  it('長南着は対象外（新宿のみ）', () => {
    expect(isUnarrivedShinjukuItem(item({ arrivalDestination: '長南' }), TODAY)).toBe(false);
  });

  it('到着先未設定は対象外', () => {
    expect(isUnarrivedShinjukuItem(item({ arrivalDestination: '' }), TODAY)).toBe(false);
  });

  it('名前が空/空白のみは対象外', () => {
    expect(isUnarrivedShinjukuItem(item({ name: '   ' }), TODAY)).toBe(false);
  });
});
