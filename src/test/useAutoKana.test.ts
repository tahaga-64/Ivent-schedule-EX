import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutoKana } from '../hooks/useAutoKana';

// ハンドラは e.data のみ参照するため、最小限の CompositionEvent 風を渡す
const comp = (data: string): any => ({ data });

/** 1セグメント分のIME入力を再現（ローマ字→かな→漢字確定） */
function typeSegment(
  bind: ReturnType<typeof useAutoKana>['bind'],
  kanaSteps: string[],
  committed: string,
) {
  act(() => bind.onCompositionStart());
  for (const k of kanaSteps) act(() => bind.onCompositionUpdate(comp(k)));
  act(() => bind.onCompositionEnd(comp(committed)));
}

describe('useAutoKana', () => {
  it('漢字変換: 変換前のかなを読みとして取得する', () => {
    const { result } = renderHook(() => useAutoKana());
    // 「ながつくえ」と打って「長机」に変換確定
    typeSegment(result.current.bind, ['な', 'なが', 'ながつくえ', '長机'], '長机');
    expect(result.current.reading).toBe('ながつくえ');
  });

  it('複数セグメントは読みを連結する', () => {
    const { result } = renderHook(() => useAutoKana());
    typeSegment(result.current.bind, ['ながつくえ', '長机'], '長机');
    typeSegment(result.current.bind, ['いす', '椅子'], '椅子');
    expect(result.current.reading).toBe('ながつくえいす');
  });

  it('変換せずかな確定でも読みに入る（updateなし→end のかな）', () => {
    const { result } = renderHook(() => useAutoKana());
    act(() => result.current.bind.onCompositionStart());
    act(() => result.current.bind.onCompositionEnd(comp('てすと')));
    expect(result.current.reading).toBe('てすと');
  });

  it('半角カナのみの確定も読みに採用する', () => {
    const { result } = renderHook(() => useAutoKana());
    act(() => result.current.bind.onCompositionStart());
    act(() => result.current.bind.onCompositionEnd(comp('ﾃｽﾄ')));
    expect(result.current.reading).toBe('ﾃｽﾄ');
  });

  it('英数など非かな確定だけなら読みは増えない', () => {
    const { result } = renderHook(() => useAutoKana());
    act(() => result.current.bind.onCompositionStart());
    act(() => result.current.bind.onCompositionEnd(comp('USB')));
    expect(result.current.reading).toBe('');
  });

  it('setReading で手動修正でき、その後の入力も正しく連結する', () => {
    const { result } = renderHook(() => useAutoKana());
    act(() => result.current.setReading('かすたむ'));
    expect(result.current.reading).toBe('かすたむ');
    typeSegment(result.current.bind, ['あ', '亜'], '亜');
    expect(result.current.reading).toBe('かすたむあ');
  });

  it('reset で初期化・任意値設定ができる', () => {
    const { result } = renderHook(() => useAutoKana());
    typeSegment(result.current.bind, ['あ', '亜'], '亜');
    expect(result.current.reading).toBe('あ');
    act(() => result.current.reset('しょきち'));
    expect(result.current.reading).toBe('しょきち');
    act(() => result.current.reset());
    expect(result.current.reading).toBe('');
  });

  it('初期値を受け取れる', () => {
    const { result } = renderHook(() => useAutoKana('しょきよみ'));
    expect(result.current.reading).toBe('しょきよみ');
  });
});
