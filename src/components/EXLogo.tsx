import { useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'motion/react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const sizeConfig: Record<Size, { fontSize: string; subtitleSize: string; glow: number }> = {
  sm: { fontSize: 'text-4xl', subtitleSize: 'text-xs', glow: 30 },
  md: { fontSize: 'text-6xl', subtitleSize: 'text-sm', glow: 40 },
  lg: { fontSize: 'text-8xl', subtitleSize: 'text-base', glow: 60 },
  xl: { fontSize: 'text-[7rem]', subtitleSize: 'text-lg', glow: 80 },
};

interface Props {
  size?: Size;
  showSubtitle?: boolean;
}

export default function EXLogo({ size = 'lg', showSubtitle = true }: Props) {
  const { fontSize, subtitleSize, glow } = sizeConfig[size];
  const controls = useAnimation();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const glowX = useTransform(mouseX, (v) => v - glow);
  const glowY = useTransform(mouseY, (v) => v - glow);

  useEffect(() => {
    (async () => {
      await controls.start('hidden');
      await new Promise((r) => setTimeout(r, 200));
      await controls.start('visible');
    })();
  }, [controls]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.5, rotateX: -90 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: { type: 'spring' as const, stiffness: 200, damping: 15 },
    },
  };

  return (
    <motion.div
      ref={containerRef}
      className="relative flex flex-col items-center select-none"
      onMouseMove={handleMouseMove}
      animate={controls}
      initial="hidden"
      variants={containerVariants}
    >
      <motion.div
        className="absolute inset-0 -z-10 blur-3xl rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(96,165,250,0.45) 0%, rgba(167,139,250,0.25) 50%, transparent 70%)',
          transform: 'scale(1.5)',
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute -z-10 rounded-full blur-2xl pointer-events-none hidden sm:block"
        style={{
          width: glow * 2,
          height: glow * 2,
          x: glowX,
          y: glowY,
          background: 'radial-gradient(circle, rgba(147,197,253,0.5) 0%, transparent 70%)',
        }}
      />

      <div className="flex items-center gap-1 [perspective:800px]">
        <motion.span
          variants={letterVariants}
          className={`${fontSize} font-black tracking-tighter leading-none bg-gradient-to-br from-cyan-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(96,165,250,0.55)]`}
          whileHover={{ scale: 1.15, rotateY: -8, transition: { type: 'spring', stiffness: 300, damping: 10 } }}
          style={{ display: 'inline-block' }}
        >
          E
        </motion.span>
        <motion.span
          variants={letterVariants}
          className={`${fontSize} font-black tracking-tighter leading-none bg-gradient-to-br from-violet-300 via-fuchsia-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.55)]`}
          whileHover={{ scale: 1.15, rotateY: 8, transition: { type: 'spring', stiffness: 300, damping: 10 } }}
          style={{ display: 'inline-block' }}
        >
          X
        </motion.span>
      </div>

      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="h-0.5 w-3/4 rounded-full mt-1"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(147,197,253,0.85), rgba(196,181,253,0.85), transparent)',
        }}
      />

      {showSubtitle && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className={`${subtitleSize} font-medium mt-2 text-white/70 tracking-[0.2em] uppercase`}
        >
          Event Manager
        </motion.p>
      )}

      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-300/70 pointer-events-none"
          initial={{ x: (i % 2 === 0 ? -1 : 1) * 20, y: (i < 2 ? -1 : 1) * 20, opacity: 0 }}
          animate={{
            x: [(i % 2 === 0 ? -1 : 1) * (20 + i * 10), (i % 2 === 0 ? -1 : 1) * (30 + i * 8), (i % 2 === 0 ? -1 : 1) * (20 + i * 10)],
            y: [(i < 2 ? -1 : 1) * (20 + i * 8), (i < 2 ? -1 : 1) * (30 + i * 12), (i < 2 ? -1 : 1) * (20 + i * 8)],
            opacity: [0, 0.7, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{ duration: 2.5 + i * 0.5, repeat: Infinity, delay: 0.8 + i * 0.3, ease: 'easeInOut' }}
        />
      ))}
    </motion.div>
  );
}
