import { useState } from 'react';
import { updateProfile, User } from 'firebase/auth';
import { motion } from 'motion/react';
interface Props {
  user: User;
  onComplete: () => void;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function ProfileSetupScreen({ user, onComplete }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('名前を入力してください'); return; }
    if (trimmed.length > 50) { setError('名前は50文字以内にしてください'); return; }
    setLoading(true);
    setError(null);
    try {
      await updateProfile(user, { displayName: trimmed });
      onComplete();
    } catch {
      setError('設定に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-cyan-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating blobs */}
      <motion.div
        animate={{ x: [0, 40, -20, 0], y: [0, -50, 20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-400/30 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ x: [0, -30, 50, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-12 -right-24 w-80 h-80 rounded-full bg-cyan-400/25 blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ x: [0, 25, -40, 0], y: [0, -28, 50, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-0 left-1/3 w-[30rem] h-72 rounded-full bg-violet-500/20 blur-3xl pointer-events-none"
      />

      {/* Card */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl px-10 py-10 max-w-sm w-full text-center shadow-[0_8px_40px_rgba(0,0,0,0.35)] relative z-10"
      >
        {/* Icon */}
        <motion.div variants={item} className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto text-3xl">
            👤
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1 variants={item} className="text-2xl font-black text-white mb-2 tracking-tight">
          はじめまして！
        </motion.h1>

        {/* Subtitle */}
        <motion.p variants={item} className="text-sm text-white/60 mb-8 font-medium">
          表示名を設定してください
        </motion.p>

        {/* Form */}
        <motion.form variants={item} onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            placeholder="お名前"
            maxLength={50}
            autoFocus
            className="w-full px-4 py-3 rounded-2xl bg-white/15 border border-white/25 text-white placeholder-white/40 text-sm font-medium outline-none focus:bg-white/20 focus:border-white/50 transition-all"
          />
          {error && (
            <p className="text-xs text-red-300 font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-white text-indigo-700 rounded-2xl font-bold text-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg"
          >
            {loading ? '設定中...' : '決定'}
          </button>
        </motion.form>
      </motion.div>
    </div>
  );
}
