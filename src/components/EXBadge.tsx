import { motion } from 'motion/react';

interface Props {
  /** バッジの一辺のサイズ（px） */
  size?: number;
  /** 1回転にかかる秒数 */
  duration?: number;
}

/**
 * ログイン画面と同じ EX ロゴを立体的に横回転させる 3D バッジ。
 * ヘッダー・ホーム画面など複数箇所で size を変えて再利用する。
 */
export default function EXBadge({ size = 36, duration = 4 }: Props) {
  const depth = size * 0.11;   // 前後フェイスの厚み
  const edgeW = size * 0.22;   // 側面の縁の幅
  const edgeH = size * 0.83;   // 側面の縁の高さ
  const fontStyle = { fontSize: size * 0.4 };

  return (
    <div style={{ perspective: size * 4 }} className="shrink-0">
      <motion.div
        className="relative"
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
        animate={{ rotateY: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      >
        {/* 前面 */}
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.45) 0%, rgba(79,70,229,0.25) 100%)',
            border: '1px solid rgba(165,180,252,0.5)',
            boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 20px rgba(96,165,250,0.4)',
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
            background: 'linear-gradient(135deg, rgba(79,70,229,0.4) 0%, rgba(49,46,129,0.3) 100%)',
            border: '1px solid rgba(129,140,248,0.4)',
            boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.25), 0 0 20px rgba(96,165,250,0.3)',
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
            top: '50%', left: '50%', width: edgeW, height: edgeH,
            transform: 'translate(-50%,-50%) rotateY(90deg)',
            background: 'linear-gradient(to bottom, rgba(129,140,248,0.6), rgba(49,46,129,0.7))',
          }}
        />
      </motion.div>
    </div>
  );
}
