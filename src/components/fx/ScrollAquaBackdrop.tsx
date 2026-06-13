/**
 * ScrollAquaBackdrop — スクロール連動の海中バックドロップ
 *
 * 4つの「劇的」演出のうち背景系を担当:
 *  1. 背景の色・世界が変化   … scrollYProgress で深海ダーク→水面ライトへグラデ遷移
 *  2. パララックス           … 光芒・泡が別速度でスクロール追従
 *  3. 速度反応               … useVelocity でスクロール速度に応じて泡が舞い、揺れる
 *
 * 親のスクロールコンテナ ref を受け取り、その可視領域いっぱいに sticky で固定。
 * theme-color メタも進捗に追従させ、ブラウザUIまで世界が変わる。
 */
import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useVelocity,
  useSpring,
  useMotionTemplate,
  useMotionValueEvent,
  type MotionValue,
} from 'motion/react';
import { useFxLevel } from '../../lib/deviceTier';

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// 単一の泡: 自前で parallax + velocity ドリフトを計算
function Bubble({
  scrollY,
  velBoost,
  depth,
  left,
  size,
  baseTop,
}: {
  scrollY: MotionValue<number>;
  velBoost: MotionValue<number>;
  depth: number;        // 0(遠)〜1(近) パララックス係数
  left: string;
  size: number;
  baseTop: string;
}) {
  // パララックス: 近い泡ほど速く上に流れる
  const parallax = useTransform(scrollY, (y) => -y * (0.12 + depth * 0.4));
  // 速度反応: 速くスクロールすると上に舞い上がる
  const vy = useTransform(velBoost, (v) => v * (0.6 + depth) * -0.04);
  const y = useTransform([parallax, vy], ([p, v]: number[]) => p + v);

  return (
    <motion.span
      className="absolute rounded-full"
      style={{
        top: baseTop,
        left,
        width: size,
        height: size,
        y,
        background: 'radial-gradient(circle at 35% 30%, rgba(224,247,255,0.9), rgba(103,232,249,0.25) 60%, transparent 70%)',
        border: '1px solid rgba(186,230,253,0.35)',
      }}
    />
  );
}

export default function ScrollAquaBackdrop({ containerRef }: Props) {
  const level = useFxLevel();
  const [vh, setVh] = useState(0);

  // コンテナの可視高さを測ってバックドロップ高に反映
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setVh(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const { scrollY, scrollYProgress } = useScroll({ container: containerRef });

  // スクロール速度（バネで平滑化）
  const rawVel = useVelocity(scrollY);
  const velBoost = useSpring(rawVel, { stiffness: 180, damping: 38, mass: 0.6 });

  // ── 世界の色: 深海 → 水面 ────────────────────────────────────────────
  const cTop = useTransform(scrollYProgress, [0, 0.55, 1], ['#082f49', '#0e7490', '#e8f4fb']);
  const cMid = useTransform(scrollYProgress, [0, 0.55, 1], ['#075985', '#22a5c4', '#cdeaf9']);
  const cBot = useTransform(scrollYProgress, [0, 0.55, 1], ['#0e7490', '#67e8f9', '#f0f9ff']);
  const gradient = useMotionTemplate`linear-gradient(180deg, ${cTop} 0%, ${cMid} 48%, ${cBot} 100%)`;

  // 光芒のパララックス + 速度による横揺れ
  const rayY = useTransform(scrollY, (y) => -y * 0.18);
  const raySkew = useTransform(velBoost, [-3000, 0, 3000], [-6, 0, 6]);
  // 上部の暗いビネット（深海感）はスクロールで薄れる
  const deepVeil = useTransform(scrollYProgress, [0, 0.7], [0.55, 0]);

  // theme-color をスクロールに追従（ブラウザUIごと世界が変わる）
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    // 082f49 → e8f4fb をざっくり補間
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * Math.min(1, p / 0.9));
    const r = lerp(0x08, 0xe8), g = lerp(0x2f, 0xf4), b = lerp(0x49, 0xfb);
    meta.setAttribute('content', `rgb(${r},${g},${b})`);
  });

  if (level === 'off') {
    return (
      <div
        aria-hidden
        className="sticky top-0 z-0 pointer-events-none"
        style={{ height: 0 }}
      >
        <div
          style={{
            height: vh || '100dvh',
            background: 'linear-gradient(180deg, var(--aqua-tint) 0%, #f0f9ff 60%, #f8fafc 100%)',
          }}
        />
      </div>
    );
  }

  const bubbleCount = level === 'full' ? 16 : 7;
  const bubbles = Array.from({ length: bubbleCount }).map((_, i) => ({
    depth: ((i * 37) % 100) / 100,
    left: `${(i * 61 + (i * i * 13)) % 96}%`,
    size: 4 + ((i * 7) % 14),
    baseTop: `${(i * 53 + 20) % 110}%`,
  }));

  return (
    <div
      aria-hidden
      className="sticky top-0 z-0 pointer-events-none select-none"
      style={{ height: 0 }}
    >
      <motion.div
        className="relative overflow-hidden"
        style={{ height: vh || '100dvh', background: gradient }}
      >
        {/* 深海ビネット（上方） */}
        <motion.div
          className="absolute inset-x-0 top-0 h-2/3"
          style={{
            opacity: deepVeil,
            background: 'linear-gradient(180deg, rgba(2,18,36,0.85) 0%, transparent 100%)',
          }}
        />

        {/* 光芒（パララックス + 速度スキュー） */}
        <motion.div
          className="absolute inset-0"
          style={{ y: rayY, skewX: raySkew }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute top-[-20%] w-24 md:w-40"
              style={{
                height: '140%',
                left: `${12 + i * 24}%`,
                transform: `rotate(${(i - 1.5) * 8}deg)`,
                background: 'linear-gradient(180deg, rgba(186,230,253,0.28) 0%, rgba(103,232,249,0.05) 55%, transparent 100%)',
                filter: 'blur(6px)',
                mixBlendMode: 'screen',
              }}
            />
          ))}
        </motion.div>

        {/* 泡（パララックス + 速度反応） */}
        {bubbles.map((b, i) => (
          <Bubble
            key={i}
            scrollY={scrollY}
            velBoost={velBoost}
            depth={b.depth}
            left={b.left}
            size={b.size}
            baseTop={b.baseTop}
          />
        ))}

        {/* 水面のきらめき（最下部） */}
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{ background: 'linear-gradient(0deg, rgba(255,255,255,0.5), transparent)' }}
        />
      </motion.div>
    </div>
  );
}
