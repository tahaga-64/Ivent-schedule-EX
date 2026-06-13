/**
 * /experience エントリルート
 *
 * useCanRender3D() の判定結果で:
 *   true  → 3D シーン（Canvas + ScrollControls + bloom）
 *   false → 静止画 + HTML テキストのフォールバック
 *
 * フォールバック時は Canvas を一切マウントしない。
 * WebGL コンテキストが作られないためメモリ・GPU・バッテリーを消費しない。
 */
import { useCanRender3D } from './useCanRender3D';
import Scene from './Scene';
import Fallback2D from './Fallback2D';

export default function ExperienceApp() {
  const can3D = useCanRender3D();
  return can3D ? <Scene /> : <Fallback2D />;
}
