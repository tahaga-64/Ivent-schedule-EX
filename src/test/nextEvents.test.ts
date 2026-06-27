import { describe, it, expect } from 'vitest';
import { summarizeNextEvents } from '../lib/nextEvents';
import type { Event } from '../types';

const TODAY = '2026-06-27';

function ev(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    start: '2026-06-30',
    end: '2026-06-30',
    region: '東日本',
    dept: '',
    type: 'その他',
    venue: '幕張メッセ',
    client: '',
    note: '',
    ...overrides,
  };
}

describe('summarizeNextEvents', () => {
  it('予定が無ければ count 0・daysToNext null・dayLabel 空', () => {
    const s = summarizeNextEvents([], TODAY);
    expect(s).toEqual({ count: 0, daysToNext: null, dayLabel: '', primaryVenue: null, venues: [] });
  });

  it('直近イベントの会場と日数を返す', () => {
    const s = summarizeNextEvents([ev({ start: '2026-06-30', end: '2026-06-30' })], TODAY);
    expect(s.count).toBe(1);
    expect(s.daysToNext).toBe(3);
    expect(s.dayLabel).toBe('3日後');
    expect(s.primaryVenue).toBe('幕張メッセ');
    expect(s.venues).toEqual(['幕張メッセ']);
  });

  it('当日開催は dayLabel が「今日」', () => {
    const s = summarizeNextEvents([ev({ start: TODAY, end: TODAY })], TODAY);
    expect(s.daysToNext).toBe(0);
    expect(s.dayLabel).toBe('今日');
  });

  it('同日複数イベントは全会場を venues に集約', () => {
    const s = summarizeNextEvents([
      ev({ id: 'a', start: '2026-06-29', venue: '幕張' }),
      ev({ id: 'b', start: '2026-06-29', venue: '横浜' }),
      ev({ id: 'c', start: '2026-07-05', venue: '大阪' }), // 別日は対象外
    ], TODAY);
    expect(s.count).toBe(2);
    expect(s.venues).toEqual(['幕張', '横浜']);
    expect(s.primaryVenue).toBe('幕張');
  });

  it('過去イベントは除外し、最も近い未来日を採用', () => {
    const s = summarizeNextEvents([
      ev({ id: 'past', start: '2026-06-01', venue: '過去' }),
      ev({ id: 'next', start: '2026-06-28', venue: '直近' }),
    ], TODAY);
    expect(s.primaryVenue).toBe('直近');
    expect(s.daysToNext).toBe(1);
  });

  it('キャンセル済みは除外', () => {
    const s = summarizeNextEvents([
      ev({ id: 'x', start: '2026-06-28', venue: '中止', status: 'cancelled' }),
      ev({ id: 'y', start: '2026-06-30', venue: '有効' }),
    ], TODAY);
    expect(s.primaryVenue).toBe('有効');
  });

  it('会場が空なら type にフォールバック', () => {
    const s = summarizeNextEvents([ev({ venue: '', type: '水族館' })], TODAY);
    expect(s.primaryVenue).toBe('水族館');
  });
});
