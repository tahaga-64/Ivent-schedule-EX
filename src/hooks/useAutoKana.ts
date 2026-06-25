import { useCallback, useRef, useState } from 'react';
import { isKanaOnly } from '../lib/kana';

/**
 * 日本語IMEの「変換前のかな（読み）」を best-effort で取得するフック。
 *
 * 仕組み:
 *  - compositionupdate では、ローマ字入力中の data が「かな」（な→なが→…）になる。
 *    変換候補に進むと data が漢字へ変わるため、直近の「かなのみ」の data を
 *    そのセグメントの読みとして保持する。
 *  - compositionend（漢字などで確定）時に、保持していたかなを読みへ追記する。
 *  - 直接入力された英数/かなは品名自体が検索対象になるため読みには含めない。
 *
 * 注意: IMEの挙動は端末・ブラウザにより差があるため確実ではない。
 *       そのため読みフィールドは編集可能にしておくこと。
 */
export function useAutoKana(initial = '') {
  const [reading, setReadingState] = useState(initial);
  const confirmedRef = useRef(initial);
  const pendingRef = useRef('');
  const composingRef = useRef(false);

  /** 読みを直接設定（手入力での修正・初期化用） */
  const setReading = useCallback((value: string) => {
    confirmedRef.current = value;
    pendingRef.current = '';
    setReadingState(value);
  }, []);

  /** フォームを開く/閉じる際の初期化 */
  const reset = useCallback((value = '') => {
    confirmedRef.current = value;
    pendingRef.current = '';
    composingRef.current = false;
    setReadingState(value);
  }, []);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
    pendingRef.current = '';
  }, []);

  const onCompositionUpdate = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    const data = e.data ?? '';
    if (isKanaOnly(data)) pendingRef.current = data;
  }, []);

  const onCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    const data = e.data ?? '';
    // pending = 変換前に保持したかな。変換せずかな確定なら最終 data を使う。
    const seg = pendingRef.current || (isKanaOnly(data) ? data : '');
    if (seg) {
      confirmedRef.current += seg;
      setReadingState(confirmedRef.current);
    }
    pendingRef.current = '';
  }, []);

  return {
    reading,
    setReading,
    reset,
    bind: { onCompositionStart, onCompositionUpdate, onCompositionEnd },
  };
}
