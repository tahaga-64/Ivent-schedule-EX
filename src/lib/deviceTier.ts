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

  // WebGL が無い端末では 3D シーンを描画できないため完全オフ。
  // （これだけが唯一「演出ゼロ」になる条件。iOS/モダン端末はまず該当しない）
  if (!probeWebGL()) return 'off';

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  // 明示的なデータセーバー指定のみ完全オフ。
  if (nav.connection?.saveData) return 'off';

  const mem   = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;

  // 注意: iOS は「省電力モード」や「視差効果を減らす」が ON だと
  // prefers-reduced-motion: reduce を報告する。これを 'off' にすると
  // スマホ利用者の大半で 3D 水槽・演出が消えてしまうため 'lite' に留める
  // （演出は出すが匹数・パーティクルを抑えて軽量化）。
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || mem <= 4 || cores <= 4) return 'lite';

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
