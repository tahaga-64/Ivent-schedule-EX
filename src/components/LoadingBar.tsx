import { motion, AnimatePresence } from 'motion/react';

interface LoadingBarProps {
  visible: boolean;
}

export default function LoadingBar({ visible }: LoadingBarProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-bar"
          className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400"
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
