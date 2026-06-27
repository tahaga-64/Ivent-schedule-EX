import { EASE_OUT, EASE_IN } from './motionTokens';
import { cachedFxLevel } from './deviceTier';

/** ビューの表示順序（ナビゲーション方向を決定するために使用） */
const VIEW_ORDER: Record<string, number> = {
  home:      0,
  calendar:  1,
  prep:      2,
  shipping:  3,
  schedule:  4,
  master:    5,
  fish:      6,
  layout:    7,
  container: 8,
  album:     9,
  archive:   10,
  kanban:    11,
};

/** 2つのビュー名から遷移方向を返す: 1=右→左(前進) / -1=左→右(後退) / 0=同一 */
export function getViewDir(from: string, to: string): number {
  const f = VIEW_ORDER[from] ?? 0;
  const t = VIEW_ORDER[to]   ?? 0;
  if (f === t) return 0;
  return t > f ? 1 : -1;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * 方向付き「水流」ビュー遷移バリアント。
 * custom prop = dir (number) を AnimatePresence + motion.div の両方に渡すこと。
 */
export const viewVariants = {
  initial: (dir: number) => {
    if (prefersReducedMotion()) return { opacity: 0 };
    const level = cachedFxLevel();
    return {
      opacity: 0,
      x: dir * 22,
      scale: 0.997,
      ...(level === 'full' ? { filter: 'blur(2px)' } : {}),
    };
  },
  animate: (dir: number) => {
    void dir;
    if (prefersReducedMotion()) {
      return { opacity: 1, transition: { duration: 0.1 } };
    }
    const level = cachedFxLevel();
    return {
      opacity: 1,
      x: 0,
      scale: 1,
      ...(level === 'full' ? { filter: 'blur(0px)' } : {}),
      transition: { duration: 0.22, ease: EASE_OUT },
    };
  },
  exit: (dir: number) => {
    if (prefersReducedMotion()) return { opacity: 0, transition: { duration: 0.08 } };
    return {
      opacity: 0,
      x: dir * -14,
      transition: { duration: 0.18, ease: EASE_IN },
    };
  },
};
