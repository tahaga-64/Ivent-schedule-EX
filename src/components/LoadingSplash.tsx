import { motion } from 'motion/react';
import EXBadge from './EXBadge';
import { useFxLevel } from '../lib/deviceTier';
import { EASE_OUT } from '../lib/motionTokens';

interface Props {
  /** When true, renders as a fixed overlay (z-[300]) with exit animation for AnimatePresence. */
  asOverlay?: boolean;
}

export default function LoadingSplash({ asOverlay }: Props) {
  const level = useFxLevel();
  const bubbleCount = level === 'full' ? 16 : level === 'lite' ? 6 : 0;

  const overlayProps = asOverlay
    ? {
        initial: { opacity: 1 } as const,
        exit: {
          opacity: 0,
          transition: { duration: 0.7, ease: EASE_OUT },
        } as const,
      }
    : {};

  const contentExitProps = asOverlay
    ? {
        exit: {
          opacity: 0,
          scale: 0.92,
          transition: { duration: 0.35, ease: EASE_OUT },
        } as const,
      }
    : {};

  return (
    <motion.div
      className={`flex items-center justify-center overflow-hidden ${
        asOverlay ? 'fixed inset-0 z-[300]' : 'fixed inset-0'
      }`}
      style={{
        background:
          'linear-gradient(180deg, #082f49 0%, #0e7490 55%, #06b6d4 100%)',
      }}
      {...overlayProps}
    >
      {/* God rays */}
      {level !== 'off' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="splash-ray splash-ray-1" />
          <div className="splash-ray splash-ray-2" />
          {level === 'full' && <div className="splash-ray splash-ray-3" />}
        </div>
      )}

      {/* Bubbles */}
      {bubbleCount > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: bubbleCount }).map((_, i) => (
            <div
              key={i}
              className="splash-bubble"
              style={{
                left: `${5 + ((i * 73 + i * i * 17) % 90)}%`,
                animationDelay: `${((i * 370) % 3000) / 1000}s`,
                animationDuration: `${3 + ((i * 500) % 3000) / 1000}s`,
                width:  `${4 + ((i * 7) % 10)}px`,
                height: `${4 + ((i * 7) % 10)}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Center logo + progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="relative z-10 flex flex-col items-center gap-8"
        {...contentExitProps}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {level !== 'off' && (
              <div
                className="absolute inset-0 scale-[1.6] blur-2xl rounded-full"
                style={{ background: 'rgba(103,232,249,0.20)' }}
              />
            )}
            <EXBadge size={112} />
          </div>
          <p
            className="text-base font-medium tracking-[0.2em] uppercase"
            style={{ color: '#a5f3fc' }}
          >
            Event Manager
          </p>
        </div>

        {/* Cyan progress shimmer */}
        <div
          className="w-40 h-[2px] rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.14)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background:
                'linear-gradient(90deg, #06b6d4, #0891b2, #155e75)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
              repeatDelay: 0.4,
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
