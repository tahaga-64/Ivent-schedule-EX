import { useRef, useEffect } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { ClipboardList } from 'lucide-react';
import { SPRING_GENTLE } from '../../lib/motionTokens';

const PEEK_DONE_KEY   = 'ivent:swipe-peek-done';
const DRAG_THRESHOLD  = -64;          // px — スワイプでアクション発火する閾値
const VEL_THRESHOLD   = -400;         // px/s — フリック速度閾値
const CLICK_SUPPRESS  = 12;           // px — 左方向にこれ以上ドラッグしたらクリックを抑止

interface Props {
  children: React.ReactNode;
  onAction: () => void;
  actionLabel?: string;
}

export default function SwipeActionCard({ children, onAction, actionLabel = '準備物リスト' }: Props) {
  const x = useMotionValue(0);
  const suppressClick = useRef(false);

  // 初回のみ 300ms peek アニメで存在を知らせる
  useEffect(() => {
    try {
      if (localStorage.getItem(PEEK_DONE_KEY)) return;
      const t = setTimeout(() => {
        animate(x, -36, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
        setTimeout(() => {
          animate(x, 0, SPRING_GENTLE);
          localStorage.setItem(PEEK_DONE_KEY, '1');
        }, 550);
      }, 900);
      return () => clearTimeout(t);
    } catch { /* ignore */ }
  }, [x]);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 背後のアクションレイヤー */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-4 rounded-2xl"
        style={{
          background:
            'linear-gradient(270deg, rgba(99,102,241,0.14) 0%, transparent 80%)',
        }}
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-0.5 text-indigo-600">
          <ClipboardList size={18} />
          <span className="text-[9px] font-black tracking-wide">{actionLabel}</span>
        </div>
      </div>

      {/* ドラッグ可能カード */}
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.04}
        onPointerDown={() => { suppressClick.current = false; }}
        onDrag={(_, info) => {
          if (info.offset.x < -CLICK_SUPPRESS) suppressClick.current = true;
        }}
        onDragEnd={(_, info) => {
          const fired =
            info.offset.x   < DRAG_THRESHOLD ||
            info.velocity.x < VEL_THRESHOLD;
          animate(x, 0, SPRING_GENTLE);
          if (fired) {
            // クリック抑止を少し遅らせてから解除
            setTimeout(() => { suppressClick.current = false; }, 80);
            onAction();
          } else {
            setTimeout(() => { suppressClick.current = false; }, 50);
          }
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
