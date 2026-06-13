import { useEffect, useRef, useState } from 'react';
import { cachedFxLevel } from '../../lib/deviceTier';

interface Props {
  value: number;
  /** アニメーション時間（ms） */
  duration?: number;
  className?: string;
  /** 小数桁 */
  decimals?: number;
}

/**
 * 数値をなめらかにカウントアップ表示する。
 * 値が変わるたび前の表示値から新しい値へ ease-out で補間する。
 * reduced-motion / 低性能端末（fxLevel 'off'）では即座に確定値を表示。
 */
export default function CountUp({ value, duration = 700, className, decimals = 0 }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (cachedFxLevel() === 'off') { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const shown = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  return <span className={className}>{shown}</span>;
}
