/**
 * LoadingSplash v2 — 海中テーマのスプラッシュスクリーン
 *
 * VITE_RIVE_SPLASH_SRC に .riv ファイルのURLを設定すると Rive アニメーションを表示。
 * 未設定の場合は CSS のみのアクア海中アニメーション（ゼロJS負荷）にフォールバック。
 */
import { lazy, Suspense } from 'react';
import EXBadge from './EXBadge';

const RiveLoader = lazy(() => import('./fx/RiveLoader'));
const RIVE_SRC = import.meta.env.VITE_RIVE_SPLASH_SRC ?? '';

export default function LoadingSplash() {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#082f49' }}>

      {/* ── CSS 海中アニメーション (常時表示) ── */}
      <style>{`
        @keyframes splash-bubble {
          0%   { transform: translateY(0) scale(1); opacity: 0.55; }
          80%  { opacity: 0.3; }
          100% { transform: translateY(-110vh) scale(0.5); opacity: 0; }
        }
        @keyframes splash-ray {
          0%   { opacity: 0.08; transform: rotate(-4deg) scaleX(1); }
          50%  { opacity: 0.18; transform: rotate(4deg) scaleX(1.15); }
          100% { opacity: 0.08; transform: rotate(-4deg) scaleX(1); }
        }
        @keyframes splash-glow {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50%       { opacity: 0.55; transform: scale(1.05); }
        }
        @keyframes splash-badge {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes splash-bar {
          0%   { width: 0%; }
          40%  { width: 55%; }
          70%  { width: 78%; }
          90%  { width: 92%; }
          100% { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-bubble, .splash-ray { display: none; }
        }
      `}</style>

      {/* 光芒 */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="splash-ray absolute top-0 left-1/2 w-16 origin-top"
          style={{
            height: '80vh',
            marginLeft: `${(i - 1) * 80}px`,
            background: 'linear-gradient(180deg, rgba(103,232,249,0.22) 0%, transparent 100%)',
            animation: `splash-ray ${4 + i * 1.3}s ease-in-out ${i * 0.7}s infinite`,
            borderRadius: '0 0 50% 50%',
            transform: `rotate(${(i - 1) * 10}deg)`,
          }}
        />
      ))}

      {/* 泡 */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="splash-bubble absolute rounded-full"
          style={{
            width:  `${6 + (i % 4) * 4}px`,
            height: `${6 + (i % 4) * 4}px`,
            left:   `${8 + (i * 7.8) % 84}%`,
            bottom: `-10px`,
            background: 'rgba(103,232,249,0.45)',
            border: '1px solid rgba(186,230,253,0.4)',
            backdropFilter: 'blur(1px)',
            animation: `splash-bubble ${5 + (i * 1.7) % 4}s ease-in ${(i * 0.55) % 4.5}s infinite`,
          }}
        />
      ))}

      {/* 中央コンテンツ */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">

        {/* Rive or EXBadge */}
        {RIVE_SRC ? (
          <Suspense fallback={<EXBadgePulse />}>
            <RiveLoader
              src={RIVE_SRC}
              className="w-48 h-48"
              style={{ animation: 'splash-badge 3s ease-in-out infinite' }}
            >
              <EXBadgePulse />
            </RiveLoader>
          </Suspense>
        ) : (
          <EXBadgePulse />
        )}

        {/* コースティクスグロー */}
        <div
          className="absolute w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(103,232,249,0.18) 0%, transparent 70%)',
            animation: 'splash-glow 3.5s ease-in-out infinite',
          }}
        />

        {/* プログレスバー */}
        <div className="w-48 h-0.5 rounded-full overflow-hidden bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #22d3ee, #67e8f9)',
              animation: 'splash-bar 3s ease-out forwards',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function EXBadgePulse() {
  return (
    <div style={{ animation: 'splash-badge 3s ease-in-out infinite' }}>
      <EXBadge size={96} />
    </div>
  );
}
