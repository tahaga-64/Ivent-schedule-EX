import { describe, it, expect } from 'vitest';

interface StaffMember { id: string; name: string; email?: string }

function sortStaffByName(list: StaffMember[]): StaffMember[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

describe('staffSort', () => {
  it('あいうえお順に並べる（ひらがな）', () => {
    const input: StaffMember[] = [
      { id: '1', name: 'やまだ' },
      { id: '2', name: 'あべ' },
      { id: '3', name: 'たなか' },
    ];
    const result = sortStaffByName(input);
    expect(result.map(s => s.name)).toEqual(['あべ', 'たなか', 'やまだ']);
  });

  it('元の配列を変更しない', () => {
    const input: StaffMember[] = [
      { id: '1', name: '鈴木' },
      { id: '2', name: '伊藤' },
    ];
    const original = [...input];
    sortStaffByName(input);
    expect(input).toEqual(original);
  });

  it('空配列は空配列を返す', () => {
    expect(sortStaffByName([])).toEqual([]);
  });

  it('1件はそのまま返す', () => {
    const input: StaffMember[] = [{ id: '1', name: '田中' }];
    expect(sortStaffByName(input)).toEqual(input);
  });

  it('STAFF_SHOW_COUNT=5 で初期表示は5件まで', () => {
    const STAFF_SHOW_COUNT = 5;
    const list: StaffMember[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      name: `スタッフ${i}`,
    }));
    const sorted = sortStaffByName(list);
    const visible = sorted.slice(0, STAFF_SHOW_COUNT);
    expect(visible).toHaveLength(5);
  });

  it('展開時は全件表示', () => {
    const STAFF_SHOW_COUNT = 5;
    const list: StaffMember[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      name: `スタッフ${i}`,
    }));
    const sorted = sortStaffByName(list);
    const expanded = true;
    const visible = sorted.slice(0, expanded ? undefined : STAFF_SHOW_COUNT);
    expect(visible).toHaveLength(8);
  });
});
