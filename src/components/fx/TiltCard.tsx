import { useRef } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { cachedFxLevel } from '../../lib/deviceTier';

interface Props {
  children: React.ReactNode;
  className?: string;
  maxAngle?: number;
}

const canTilt =
  typeof window !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  cachedFxLevel() !== 'off';

export default function TiltCard({ children, className = '', maxAngle = 5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useSpring(0, { stiffness: 200, damping: 30, restDelta: 0.001 });
  const mouseY = useSpring(0, { stiffness: 200, damping: 30, restDelta: 0.001 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [ maxAngle, -maxAngle]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-maxAngle,  maxAngle]);

  if (!canTilt) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mouseX.set((e.clientX - rect.left) / rect.width  - 0.5);
        mouseY.set((e.clientY - rect.top)  / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
