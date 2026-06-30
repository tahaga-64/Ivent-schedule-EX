import { describe, it, expect } from 'vitest';
import { isJapaneseHoliday } from '../lib/exScheduleConstants';

// month は 0 始まり（new Date と同じ）
describe('isJapaneseHoliday（2026年）', () => {
  it('海の日 7/20 は祝日', () => {
    expect(isJapaneseHoliday(2026, 6, 20)).toBe(true);
  });
  it('海の日の翌日 7/21 は祝日でない', () => {
    expect(isJapaneseHoliday(2026, 6, 21)).toBe(false);
  });
  it('振替休日 5/6 は祝日', () => {
    expect(isJapaneseHoliday(2026, 4, 6)).toBe(true);
  });
  it('国民の休日 9/22 は祝日', () => {
    expect(isJapaneseHoliday(2026, 8, 22)).toBe(true);
  });
  it('元日 1/1 は祝日', () => {
    expect(isJapaneseHoliday(2026, 0, 1)).toBe(true);
  });
  it('2026年以外（2025/7/20）は祝日でない', () => {
    expect(isJapaneseHoliday(2025, 6, 20)).toBe(false);
  });
});
