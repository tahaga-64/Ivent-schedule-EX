import { motion } from 'motion/react';
import EXLogo from './EXLogo';

export default function LoadingSplash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage: "image-set(url('/mercury-office.webp') type('image/webp'), url('/mercury-office.jpg') type('image/jpeg'))",
        }}
      />
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-10"
      >
        <EXLogo size="lg" showSubtitle />
        <div className="w-40 h-[2px] bg-white/15 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400"
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.2 }}
          />
        </div>
      </motion.div>
    </div>
  );
}
