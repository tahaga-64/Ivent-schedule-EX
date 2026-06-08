import { useRef, useState } from 'react';
import { motion, useMotionValue, useAnimationFrame, animate, AnimatePresence } from 'motion/react';

interface Props {
  /** バッジの一辺のサイズ（px） */
  size?: number;
  /** 1回転にかかる秒数（巡航速度） */
  duration?: number;
}

/**
 * ログイン画面と同じ EX ロゴを立体的に横回転させる 3D バッジ。
 *
 * タップすると「コインを弾く」ような物理的フィードバックを返す:
 *  - 回転方向が反転し、強いインパルス（巡航の約10倍速）が注入される
 *  - 速度は単一の requestAnimationFrame ループ上で指数的に巡航速度へ収束
 *    （アニメーションの再スタートが無いので完全にシームレス）
 *  - スケールがバネのオーバーシュートでポップ
 *  - 背後のグロウがフラッシュし、衝撃波リングとスパークルが弾ける
 */
export default function EXBadge({ size = 36, duration = 4 }: Props) {
  const depth = size * 0.11;
  const edgeW = size * 0.22;
  const edgeH = size * 0.83;
  const fontStyle = { fontSize: size * 0.4 };

  // --- 連続回転を駆動する状態（再レンダー不要なので ref / motionValue） ---
  const rotateY = useMotionValue(0);
  const scale = useMotionValue(1);
  const glow = useMotionValue(0.35);

  const baseSpeed = 360 / duration; // deg/秒（巡航速度）
  const dir = useRef<1 | -1>(1);
  const velocity = useRef(baseSpeed); // 現在の角速度 deg/秒（符号付き）

  // 衝撃波エフェクトのインスタンス管理
  const burstId = useRef(0);
  const [bursts, setBursts] = useState<number[]>([]);

  // 単一の rAF ループ: 速度を巡航へ収束させながら回転を積分
  useAnimationFrame((_, delta) => {
    const dt = Math.min(delta, 64) / 1000; // タブ復帰時の巨大 delta をクランプ
    const cruise = baseSpeed * dir.current;
    // 指数イージング: velocity → cruise（フレームレート非依存）
    velocity.current += (cruise - velocity.current) * (1 - Math.exp(-dt * 2.6));
    let next = rotateY.get() + velocity.current * dt;
    next %= 360; // 360°≡0° なので剰余を取っても視覚的に連続
    rotateY.set(next);
  });

  const handleTap = () => {
    // 方向を反転し、新方向へ強いインパルスを注入
    dir.current = (dir.current * -1) as 1 | -1;
    velocity.current = baseSpeed * 10 * dir.current;

    // バネのオーバーシュートでポップ
    animate(scale, [1, 1.24, 0.95, 1], {
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1],
    });
    // グロウをフラッシュさせて巡航値へ戻す
    glow.set(1);
    animate(glow, 0.35, { duration: 0.75, ease: 'easeOut' });

    // 衝撃波 + スパークルを生成
    const id = burstId.current++;
    setBursts((b) => [...b, id]);
  };

  return (
    <div
      style={{ perspective: size * 4 }}
      className="relative shrink-0 cursor-pointer select-none touch-none"
      onPointerDown={handleTap}
    >
      {/* 背後のグロウ（タップでフラッシュ） */}
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full pointer-events-none -z-10"
        style={{
          width: size * 1.9,
          height: size * 1.9,
          x: '-50%',
          y: '-50%',
          opacity: glow,
          background:
            'radial-gradient(circle, rgba(129,140,248,0.55) 0%, rgba(96,165,250,0.25) 42%, transparent 70%)',
          filter: 'blur(6px)',
        }}
      />

      {/* 衝撃波リング + スパークル */}
      <AnimatePresence>
        {bursts.map((id) => (
          <BurstFX
            key={id}
            size={size}
            onDone={() => setBursts((b) => b.filter((x) => x !== id))}
          />
        ))}
      </AnimatePresence>

      {/* 回転する 3D バッジ本体 */}
      <motion.div
        className="relative"
        style={{
          width: size,
          height: size,
          transformStyle: 'preserve-3d',
          rotateY,
          scale,
        }}
      >
        {/* 前面 */}
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(99,102,241,0.45) 0%, rgba(79,70,229,0.25) 100%)',
            border: '1px solid rgba(165,180,252,0.5)',
            boxShadow:
              'inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 20px rgba(96,165,250,0.4)',
            transform: `translateZ(${depth}px)`,
          }}
        >
          <span
            className="font-black bg-gradient-to-br from-cyan-300 via-indigo-200 to-violet-400 bg-clip-text text-transparent tracking-tighter leading-none"
            style={{ ...fontStyle, filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.9))' }}
          >
            EX
          </span>
        </div>
        {/* 背面 */}
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(79,70,229,0.4) 0%, rgba(49,46,129,0.3) 100%)',
            border: '1px solid rgba(129,140,248,0.4)',
            boxShadow:
              'inset 0 1px 3px rgba(255,255,255,0.25), 0 0 20px rgba(96,165,250,0.3)',
            transform: `translateZ(-${depth}px) rotateY(180deg)`,
          }}
        >
          <span
            className="font-black bg-gradient-to-br from-violet-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent tracking-tighter leading-none"
            style={{ ...fontStyle, filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.9))' }}
          >
            EX
          </span>
        </div>
        {/* 厚み（側面の縁） */}
        <div
          className="absolute rounded-full"
          style={{
            top: '50%',
            left: '50%',
            width: edgeW,
            height: edgeH,
            transform: 'translate(-50%,-50%) rotateY(90deg)',
            background:
              'linear-gradient(to bottom, rgba(129,140,248,0.6), rgba(49,46,129,0.7))',
          }}
        />
      </motion.div>
    </div>
  );
}

/** タップ時の衝撃波リング + 放射状スパークル。リング完了で自己破棄。 */
function BurstFX({ size, onDone }: { size: number; onDone: () => void }) {
  const SPARKS = 8;
  const dist = size * 1.5;
  return (
    <>
      {/* 衝撃波リング */}
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
        style={{
          width: size,
          height: size,
          x: '-50%',
          y: '-50%',
          border: '2px solid rgba(165,180,252,0.75)',
          boxShadow: '0 0 12px rgba(129,140,248,0.6)',
        }}
        initial={{ scale: 0.55, opacity: 0.9 }}
        animate={{ scale: 2.7, opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={onDone}
      />
      {/* 放射状スパークル */}
      {Array.from({ length: SPARKS }).map((_, i) => {
        const ang = (i / SPARKS) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
            style={{
              width: size * 0.11,
              height: size * 0.11,
              background: 'radial-gradient(circle, #e0e7ff 0%, #818cf8 70%, transparent 100%)',
              boxShadow: '0 0 6px rgba(165,180,252,0.95)',
            }}
            initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 1 }}
            animate={{
              x: `calc(-50% + ${Math.cos(ang) * dist}px)`,
              y: `calc(-50% + ${Math.sin(ang) * dist}px)`,
              opacity: 0,
              scale: 0.2,
            }}
            transition={{ duration: 0.66, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </>
  );
}
