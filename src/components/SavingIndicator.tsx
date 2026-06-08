import { motion, AnimatePresence } from 'motion/react';

interface SavingIndicatorProps {
  isSaving: boolean;
  saveError: string | null;
  onDismissError: () => void;
}

export default function SavingIndicator({ isSaving, saveError, onDismissError }: SavingIndicatorProps) {
  return (
    <AnimatePresence>
      {isSaving && (
        <motion.div
          key="sync"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 md:bottom-10 right-4 md:right-10 z-[100] flex items-center gap-3 bg-zinc-900 dark:bg-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 pointer-events-none"
        >
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute w-2 h-2 bg-white rounded-full blur-[2px]"
            />
            <div className="relative w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cloud Syncing...</span>
        </motion.div>
      )}
      {saveError && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          role="alert"
          onClick={onDismissError}
          className="fixed bottom-24 md:bottom-10 right-4 md:right-10 z-[100] flex items-start gap-3 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl max-w-sm cursor-pointer"
        >
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">保存エラー</div>
            <div className="text-xs font-bold leading-snug">{saveError}</div>
            <div className="text-[10px] opacity-70 mt-1">タップで閉じる</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
