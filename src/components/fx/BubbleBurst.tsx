import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cachedFxLevel } from '../../lib/deviceTier';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  tx: number;
  ty: number;
  hue: number;
}

interface BurstInstance {
  id: number;
  bubbles: Bubble[];
}

let _dispatch: React.Dispatch<React.SetStateAction<BurstInstance[]>> | null = null;

export function burstAt(cx: number, cy: number, count?: number) {
  const level = cachedFxLevel();
  if (level === 'off') return;
  const n = count ?? (level === 'full' ? 12 : 6);
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const bubbles: Bubble[] = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 50 + Math.random() * 60;
    return {
      id: i,
      x: cx,
      y: cy,
      size: 4 + Math.random() * 7,
      tx: Math.cos(angle) * speed,
      ty: Math.sin(angle) * speed - 35,
      hue: 185 + Math.random() * 40,
    };
  });
  _dispatch?.(prev => [...prev, { id, bubbles }]);
  setTimeout(() => _dispatch?.(prev => prev.filter(b => b.id !== id)), 900);
}

export default function BubbleBurstPortal() {
  const [bursts, setBursts] = useState<BurstInstance[]>([]);

  useEffect(() => {
    _dispatch = setBursts;
    return () => { _dispatch = null; };
  }, []);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[500] overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {bursts.flatMap(burst =>
          burst.bubbles.map(b => (
            <motion.span
              key={`${burst.id}-${b.id}`}
              initial={{ x: 0, y: 0, scale: 0.3, opacity: 0.9 }}
              animate={{ x: b.tx, y: b.ty, scale: 1, opacity: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'fixed',
                left: b.x - b.size / 2,
                top: b.y - b.size / 2,
                width: b.size,
                height: b.size,
                borderRadius: '50%',
                background: `hsla(${b.hue}, 80%, 65%, 0.85)`,
                border: `1px solid hsla(${b.hue}, 90%, 80%, 0.5)`,
              }}
            />
          ))
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
