/**
 * SplineScene — @splinetool/runtime のラッパー
 *
 * Spline で作成・公開した 3D シーンをインタラクティブに表示。
 * sceneUrl が空の場合はアクアグラデーション fallback を表示。
 *
 * 使い方:
 *   // 環境変数からシーンURLを渡す（src からも直指定可）
 *   <SplineScene sceneUrl={import.meta.env.VITE_SPLINE_SCENE_URL} />
 *
 * Spline シーンのpublish URL例:
 *   https://prod.spline.design/xxxxxxxxxxxxxxxx/scene.splinecode
 */
import { useEffect, useRef, useState } from 'react';
import { Application } from '@splinetool/runtime';
import { cachedFxLevel } from '../../lib/deviceTier';

interface SplineSceneProps {
  /** Spline 公開 URL（例: https://prod.spline.design/xxx/scene.splinecode） */
  sceneUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  /** ロード中に表示するコンテンツ */
  loadingFallback?: React.ReactNode;
}

export default function SplineScene({
  sceneUrl,
  className = '',
  style,
  loadingFallback,
}: SplineSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const level = cachedFxLevel();

  useEffect(() => {
    if (!sceneUrl || !canvasRef.current || level === 'off') return;

    let disposed = false;
    const canvas = canvasRef.current;

    const app = new Application(canvas);
    appRef.current = app;

    app.load(sceneUrl)
      .then(() => {
        if (!disposed) setLoaded(true);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });

    return () => {
      disposed = true;
      try {
        app.dispose();
      } catch {
        // dispose が例外を出す実装の場合は無視
      }
      appRef.current = null;
    };
  }, [sceneUrl, level]);

  // sceneUrl なし、または off tier、またはエラー → グラデーション fallback
  const showFallback = !sceneUrl || level === 'off' || error;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {/* Spline キャンバス */}
      {!showFallback && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
        />
      )}

      {/* fallback: アクア海中グラデーション */}
      {(showFallback || !loaded) && (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, #0e7490 0%, #075985 45%, #082f49 100%)',
          }}
        >
          {/* 光芒: CSS のみ */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'repeating-conic-gradient(from 270deg at 50% -10%, transparent 0deg 8deg, rgba(103,232,249,0.4) 9deg 10deg, transparent 11deg 30deg)',
              animation: 'spline-ray 8s linear infinite',
            }}
          />
          <style>{`
            @keyframes spline-ray {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* ローディング中 */}
      {!showFallback && !loaded && loadingFallback && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {loadingFallback}
        </div>
      )}
    </div>
  );
}
