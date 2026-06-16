import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cachedFxLevel } from '../../lib/deviceTier';

interface Ripple {
  id: number;
  x: number;
  y: number;
  r: number;
}

interface Props {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

export default function RippleButton({ children, onClick, className = '', disabled, type = 'button', ...rest }: Props) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const canRipple = cachedFxLevel() !== 'off';

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e);
    if (!canRipple || disabled) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const r = Math.max(rect.width, rect.height);
    const id = Date.now() + Math.random();
    setRipples(prev => [...prev, { id, x, y, r }]);
    setTimeout(() => setRipples(prev => prev.filter(rp => rp.id !== id)), 600);
  }

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      {...rest}
    >
      {children}
      {canRipple && (
        <AnimatePresence>
          {ripples.map(rp => (
            <motion.span
              key={rp.id}
              initial={{ scale: 0, opacity: 0.45 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                borderRadius: '50%',
                width: rp.r,
                height: rp.r,
                left: rp.x - rp.r / 2,
                top: rp.y - rp.r / 2,
                background: 'rgba(103, 232, 249, 0.35)',
              }}
            />
          ))}
        </AnimatePresence>
      )}
    </button>
  );
}
