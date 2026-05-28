import { useEffect, useRef, useState } from 'react';

interface ScrollBackgroundProps {
  images: string[];
  /** 全スクロール範囲のうち、背景切り替えに使う割合（0〜1）。デフォルト1.0 */
  scrollRange?: number;
  className?: string;
}

/**
 * スクロール量に連動して背景画像をクロスフェードするコンポーネント。
 * position: fixed で画面全体に固定される。z-index は -1（コンテンツの背面）。
 *
 * 使い方:
 *   <ScrollBackground images={['url1', 'url2', 'url3']} />
 *   <div>（コンテンツ）</div>
 */
export default function ScrollBackground({
  images,
  scrollRange = 1.0,
  className = '',
}: ScrollBackgroundProps) {
  const [opacities, setOpacities] = useState<number[]>(
    images.map((_, i) => (i === 0 ? 1 : 0))
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (images.length <= 1) return;

    const update = () => {
      const scrollY = window.scrollY;
      const maxScroll =
        (document.documentElement.scrollHeight - window.innerHeight) * scrollRange;

      if (maxScroll <= 0) {
        setOpacities(images.map((_, i) => (i === 0 ? 1 : 0)));
        return;
      }

      const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      const n = images.length;

      // opacity_i = clamp(1 - |progress*(n-1) - i|, 0, 1)
      const next = images.map((_, i) => {
        const raw = 1 - Math.abs(progress * (n - 1) - i);
        return Math.min(Math.max(raw, 0), 1);
      });

      setOpacities(next);
    };

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        update();
        rafRef.current = null;
      });
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [images, scrollRange]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      {images.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-center bg-cover"
          style={{
            backgroundImage: `url(${src})`,
            opacity: opacities[i] ?? 0,
            transition: 'opacity 0.4s ease-out',
            willChange: 'opacity',
          }}
        />
      ))}
      {/* 暗幕オーバーレイ: テキストの読みやすさを確保 */}
      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
