/**
 * 3D Experience — 端末フォールバック（静止画 + 通常 HTML）
 *
 * 表示条件:
 *   - WebGL 非対応端末
 *   - 低スペックモバイル（≤4コア かつ タッチ端末）
 *   - prefers-reduced-motion: reduce ユーザー
 *
 * Canvas を一切生成しないため、GPU・バッテリー消費ゼロ。
 * projects.ts を 3D 版と共有し、案件データの二重管理なし。
 * 通常スクロールで読めるシンプルな HTML ページ。
 */
import { PROJECTS } from './projects';

// ─── プレースホルダ画像（将来スクショ差し替え想定）──────────────
// 実際のスクリーンショットができたら public/experience/ に置き、
// src を "/experience/env1.webp" などに書き換えるだけでよい。
const PLACEHOLDER_IMAGES = [
  null, // 環境1: null のときはグラデーション代替表示
  null, // 環境2: null のときはグラデーション代替表示
];

const ENV_GRADIENTS = [
  'linear-gradient(135deg, #05060A 0%, #0a1a2e 40%, #0d3a5a 100%)', // シアン系
  'linear-gradient(135deg, #05060A 0%, #1a0a20 40%, #3a0a30 100%)', // マゼンタ系
];

// ─── サブコンポーネント ───────────────────────────────────────

function PlaceholderImage({ index }: { index: number }) {
  const src = PLACEHOLDER_IMAGES[index];

  if (src) {
    return (
      <img
        src={src}
        alt={`${PROJECTS[index].title} 3D environment preview`}
        style={{
          width: '100%',
          height: '240px',
          objectFit: 'cover',
          borderRadius: '12px',
          display: 'block',
        }}
      />
    );
  }

  // 画像がない間はグラデーションで代替
  return (
    <div
      aria-label={`${PROJECTS[index].title} 3D environment preview (placeholder)`}
      style={{
        width: '100%',
        height: '240px',
        borderRadius: '12px',
        background: ENV_GRADIENTS[index] ?? ENV_GRADIENTS[0],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(0,212,255,0.15)',
      }}
    >
      <span style={{ color: 'rgba(0,212,255,0.45)', fontSize: '0.78rem', letterSpacing: '0.1em' }}>
        3D PREVIEW
      </span>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────

export default function Fallback2D() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#05060A',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        overflowY: 'auto',
        padding: '0 0 80px',
      }}
    >
      {/* ヘッダー */}
      <header
        style={{
          padding: '48px 24px 32px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(0,212,255,0.10)',
          marginBottom: '16px',
        }}
      >
        <p
          style={{
            fontSize: '0.72rem',
            letterSpacing: '0.15em',
            color: 'rgba(0,212,255,0.55)',
            marginBottom: '12px',
            textTransform: 'uppercase',
          }}
        >
          Portfolio
        </p>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#e0f7ff',
            letterSpacing: '0.04em',
          }}
        >
          Projects
        </h1>
      </header>

      {/* 案件リスト */}
      <main>
        {PROJECTS.map((proj, i) => (
          <article
            key={proj.id}
            style={{
              maxWidth: '520px',
              margin: '0 auto 48px',
              padding: '0 24px',
            }}
          >
            {/* プレースホルダ画像（後でスクショに差し替え）*/}
            {i < PLACEHOLDER_IMAGES.length && <PlaceholderImage index={i} />}

            {/* 案件テキスト（クローラ・スクリーンリーダーが直接読める）*/}
            <div style={{ marginTop: '24px' }}>
              <h2
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 600,
                  color: '#e0f7ff',
                  marginBottom: '8px',
                  letterSpacing: '0.03em',
                  textShadow: '0 0 18px rgba(0,212,255,0.3)',
                }}
              >
                {proj.title}
              </h2>

              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'rgba(180,230,255,0.82)',
                  lineHeight: 1.65,
                  marginBottom: '16px',
                }}
              >
                {proj.desc}
              </p>

              {/* タグ一覧 */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '20px',
                }}
              >
                {proj.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.68rem',
                      padding: '3px 10px',
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
                  display: 'inline-block',
                  fontSize: '0.8rem',
                  color: 'rgba(150,210,255,0.8)',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(0,212,255,0.35)',
                  textUnderlineOffset: '3px',
                  letterSpacing: '0.07em',
                }}
              >
                View project ›
              </a>
            </div>

            {/* セクション区切り（最後の項目には表示しない）*/}
            {i < PROJECTS.length - 1 && (
              <hr
                style={{
                  marginTop: '48px',
                  border: 'none',
                  borderTop: '1px solid rgba(0,212,255,0.08)',
                }}
              />
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
