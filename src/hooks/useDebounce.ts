import { useRef, useCallback, useEffect } from 'react';

/**
 * 実効関数をデバウンスするカスタムフック
 * callbackが更新されても、デバウンスされた関数の同一性は保持されます。
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const callbackRef = useRef(callback);
  
  // callbackが更新されたときに最新のものを保持
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // コンポーネントがアンマウントされたときにタイムアウトをクリア
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
