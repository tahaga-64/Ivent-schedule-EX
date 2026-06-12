import { useEffect, useState } from 'react';

export type FxLevel = 'off' | 'lite' | 'full';

function probeWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export function fxLevel(): FxLevel {
  if (typeof window === 'undefined') return 'lite';

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) return 'off';

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) return 'off';

  const mem = nav.deviceMemory ?? 8;
  if (mem <= 2) return 'off';
  if (mem <= 4) return 'lite';

  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores <= 2) return 'lite';

  if (!probeWebGL()) return 'lite';

  return 'full';
}

let _cached: FxLevel | null = null;

export function cachedFxLevel(): FxLevel {
  if (_cached === null) _cached = fxLevel();
  return _cached;
}

export function useFxLevel(): FxLevel {
  const [level, setLevel] = useState<FxLevel>(cachedFxLevel);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => {
      _cached = null;
      setLevel(fxLevel());
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return level;
}
