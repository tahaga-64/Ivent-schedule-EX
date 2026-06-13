/**
 * RiveLoader — @rive-app/react-canvas のラッパー
 *
 * src に .riv ファイルの URL を渡すだけで Rive アニメーションを表示。
 * ロード失敗・未設定時は fallback children を表示（ゼロクラッシュ設計）。
 *
 * 使い方:
 *   <RiveLoader src="/animations/splash.riv" stateMachine="Main">
 *     <EXBadge size={96} />   ← Rive 失敗時のフォールバック
 *   </RiveLoader>
 */
import { useEffect, useRef, useState } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

interface RiveLoaderProps {
  /** .riv ファイルのパス or URL */
  src: string;
  /** ステートマシン名（省略可） */
  stateMachine?: string;
  /** アニメーション名（ステートマシン未使用時） */
  animationName?: string;
  /** 追加の className */
  className?: string;
  style?: React.CSSProperties;
  /** Rive ロード失敗時や src 未設定時のフォールバック */
  children?: React.ReactNode;
  /** ループ再生するか（デフォルト: true） */
  loop?: boolean;
}

export default function RiveLoader({
  src,
  stateMachine,
  animationName,
  className = '',
  style,
  children,
  loop = true,
}: RiveLoaderProps) {
  const [error, setError] = useState(false);
  const errorRef = useRef(false);

  const { rive, RiveComponent } = useRive({
    src,
    stateMachines: stateMachine ? [stateMachine] : undefined,
    animations: animationName ? [animationName] : undefined,
    autoplay: true,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
    onLoadError: () => {
      if (!errorRef.current) {
        errorRef.current = true;
        setError(true);
      }
    },
  });

  useEffect(() => {
    return () => {
      rive?.cleanup();
    };
  }, [rive]);

  if (error || !src) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <RiveComponent />
    </div>
  );
}
