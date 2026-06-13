/**
 * 3D Experience — 案件情報 HTML オーバーレイ
 *
 * ── <Scroll html> が何をしているか ───────────────────────────────
 * ScrollControls はスクロール量を offset(0〜1) として Three.js 側に渡す。
 * <Scroll html> はそれと同じ値を使い、CSS translateY として HTML の div に
 * 毎フレーム適用するラッパー。CameraRig もこの offset を読むため、
 * 3D カメラと HTML パネルは追加の同期コードなしに自然に連動する。
 * ─────────────────────────────────────────────────────────────────
 *
 * ── なぜ opacity を React state でなく DOM 直接更新するのか ──────
 * setState → 仮想DOM diff → 再レンダー のサイクルが毎フレーム(60回/秒)
 * 走るとフレームレートが落ちる。useFrame 内で ref.current.style.opacity を
 * 直接書けば React の reconciler を完全にスキップでき、1フレームの JS 予算を
 * 浪費しない。
 * ─────────────────────────────────────────────────────────────────
 *
 * ── reflow / repaint と opacity が軽い理由 ───────────────────────
 * reflow: 要素の位置・サイズを再計算（他要素にも波及、重い）。
 * repaint: ピクセルを再描画（自要素のみ、やや軽い）。
 * opacity / transform は GPU コンポジタ層で処理されるため CPU 側で
 * reflow も repaint も発生しない（最も軽い）。
 * will-change: opacity を指定すると GPU レイヤーに昇格してさらに最適化される。
 * ─────────────────────────────────────────────────────────────────
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import { PROJECTS } from './projects';

// ─── モジュールレベルの DOM refs ──────────────────────────────────
// OverlayController（Canvas 内）と ProjectOverlay（Scroll html 内）の
// 両方から同じオブジェクトを import することで、Canvas 外の DOM を
// useFrame から直接操作できる。React Context や props 不要。

export const panelRefs: { current: Array<HTMLDivElement | null> } = {
  current: PROJECTS.map(() => null),
};

// ─── Canvas 内コントローラー（useFrame で opacity を更新）──────────

export function OverlayController() {
  /**
   * scroll.range(from, distance):
   *   offset が [from, from+distance] の区間を 0→1 で返す。
   *   これで「このスクロール区間だけ表示」という論理を数値で表現できる。
   */
  const scroll = useScroll();

  // 前フレームの opacity を保持し、変化がないフレームは DOM 更新をスキップする
  const prevOpacity = useRef<number[]>(PROJECTS.map(() => -1));

  useFrame(() => {
    PROJECTS.forEach((proj, i) => {
      const el = panelRefs.current[i];
      if (!el) return;

      // フェードイン × (1 - フェードアウト) → 区間外は 0、区間内は 0〜1
      const fadeIn  = scroll.range(proj.fadeIn.from,  proj.fadeIn.dist);
      const fadeOut = scroll.range(proj.fadeOut.from, proj.fadeOut.dist);
      const opacity = Math.max(0, Math.min(1, fadeIn * (1 - fadeOut)));

      // 変化量が微小ならスキップ（GPU コンポジタの余計なレイヤー更新を防ぐ）
      if (Math.abs(opacity - prevOpacity.current[i]) < 0.002) return;
      prevOpacity.current[i] = opacity;

      // opacity のみ変更 → reflow/repaint なし、GPU コンポジタだけが動く
      el.style.opacity = String(opacity);

      // 非表示パネルの pointer-events を none に → 裏のリンクを誤クリックさせない
      // pointer-events は視覚プロパティではないため reflow も起きない
      el.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
    });
  });

  return null;
}

// ─── HTML パネル本体（<Scroll html> の中身として使う）─────────────

function ProjectPanel({ index }: { index: number }) {
  const proj = PROJECTS[index];

  return (
    /*
     * 外側 div: スクロールコンテナ内でこのパネルが属する「ページ」領域。
     * height: 100vh で 1 ページ分を確保し、flexbox で内容を下寄せ中央に配置する。
     * pointerEvents: none でラッパー自体はクリック領域を持たない。
     */
    <div
      style={{
        position: 'absolute',
        top: proj.scrollTop,
        left: 0,
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '12vh',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    >
      {/*
       * 内側 div: OverlayController が ref 経由で opacity / pointerEvents を書き換える。
       * will-change: opacity → GPU レイヤーに昇格しコンポジタ処理のみで描画。
       * opacity 初期値 0 → 最初の useFrame で適切な値に上書きされる。
       *
       * ★ pointer-events の継承について:
       *   HTML では pointer-events はデフォルト inherit されないため、
       *   a タグに `pointer-events: inherit` を明示して親の値に追従させる。
       *   これにより非表示時（panel=none）はリンクもクリック不可になる。
       */}
      <div
        ref={(el) => { panelRefs.current[index] = el; }}
        style={{
          opacity: 0,
          willChange: 'opacity',
          pointerEvents: 'none',
          textAlign: 'center',
          maxWidth: '400px',
          padding: '0 24px',
          color: '#ffffff',
          fontFamily: 'inherit',
        }}
      >
        <h2
          style={{
            fontSize: '1.75rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginBottom: '0.5rem',
            color: '#e0f7ff',
            // テキストシャドウで「3D 空間に浮かぶ発光文字」感を出す
            textShadow: '0 0 18px rgba(0,212,255,0.55), 0 0 40px rgba(0,212,255,0.18)',
            lineHeight: 1.2,
          }}
        >
          {proj.title}
        </h2>

        <p
          style={{
            fontSize: '0.875rem',
            color: 'rgba(180,230,255,0.82)',
            marginBottom: '1rem',
            lineHeight: 1.65,
            letterSpacing: '0.02em',
          }}
        >
          {proj.desc}
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          {proj.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.68rem',
                padding: '2px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(0,212,255,0.30)',
                color: 'rgba(0,212,255,0.85)',
                background: 'rgba(0,212,255,0.06)',
                letterSpacing: '0.04em',
                lineHeight: 1.8,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <a
          href={proj.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.78rem',
            color: 'rgba(150,210,255,0.72)',
            textDecoration: 'underline',
            textDecorationColor: 'rgba(0,212,255,0.28)',
            textUnderlineOffset: '3px',
            letterSpacing: '0.07em',
            // inherit で親パネルの pointer-events に追従
            // → パネルが none のとき link も none、auto のとき link も auto
            pointerEvents: 'inherit',
          }}
        >
          View project ›
        </a>
      </div>
    </div>
  );
}

export function ProjectOverlay() {
  return (
    <>
      {PROJECTS.map((_, i) => (
        <ProjectPanel key={PROJECTS[i].id} index={i} />
      ))}
    </>
  );
}
