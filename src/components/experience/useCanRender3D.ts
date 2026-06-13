/**
 * 3D シーンを描画できる端末か判定するフック
 *
 * ── WebGL コンテキスト取得で対応可否を判定する仕組み ─────────────
 * 非表示の <canvas> を一時生成し、getContext('webgl2') を試みる。
 * ブラウザ側に WebGL ドライバがなければ null が返り、不可と判定できる。
 * 実際のレンダリングには使わずすぐ破棄するため副作用ゼロ。
 * ─────────────────────────────────────────────────────────────────
 *
 * ── prefers-reduced-motion を尊重する理由 ──────────────────────────
 * OS レベルの「アニメーションを減らす」設定は、前庭障害・車酔い・
 * てんかん発作リスクなど医学的な理由で設定するユーザーがいる。
 * 高速スクロール + カメラ移動は特に影響が大きいため、
 * このシグナルがある場合は静的フォールバックに切り替えるのがアクセシビリティの原則。
 * ─────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';

// ─── 判定基準定数 ─────────────────────────────────────────────

/**
 * CPU コア数の下限閾値。
 * 4コア以下は低〜中スペックのモバイル傾向が高い。
 * navigator.hardwareConcurrency は論理コア数を返す（物理コア×スレッド数）。
 */
const LOW_CPU_THRESHOLD = 4;

// ─── 判定ロジック（同期・副作用最小）───────────────────────────

function checkCanRender3D(): boolean {
  // SSR / window 未定義ガード。このプロジェクトは Vite SPA なので
  // 実際には常にクライアントサイドだが、将来 SSR 化に備えて保険を入れる。
  if (typeof window === 'undefined') return false;

  // prefers-reduced-motion: reduce → 強制フォールバック（アクセシビリティ）
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  // WebGL 対応確認: canvas を DOM に追加せず getContext を試みるだけ
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    // コンテキストを取得したらすぐ解放（メモリリーク防止）
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    ext?.loseContext();
  } catch {
    return false;
  }

  // 低スペックモバイル判定:
  //   CPU が低い（≤4コア）かつ pointer:coarse（=タッチ端末）の組み合わせを
  //   「3D が重い可能性が高いモバイル」と見なす。
  //   PC は pointer:fine なので低コアでも 3D を表示する（GPU は別途優秀なことが多い）。
  const isLowCPU = (navigator.hardwareConcurrency ?? 8) <= LOW_CPU_THRESHOLD;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (isLowCPU && isCoarsePointer) return false;

  return true;
}

/**
 * 3D シーンを描画できるか判定するフック。
 * 初回マウント時に 1 回だけ評価し、以後は変わらない（useState 遅延初期化）。
 * ページリロードで再判定される。
 */
export function useCanRender3D(): boolean {
  // useState の第一引数に関数を渡すと「遅延初期化」になり、
  // マウント時に 1 度だけ呼ばれる。setState より先に同期実行されるため
  // レンダリングが 2 回走らない（=フラッシュなし）。
  const [canRender] = useState<boolean>(() => checkCanRender3D());
  return canRender;
}
