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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="bg-white border border-slate-200 rounded-3xl px-10 py-10 max-w-sm w-full text-center shadow-lg relative z-10"
      >
        <motion.div variants={item} className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto text-3xl">
            👤
          </div>
        </motion.div>

        <motion.h1 variants={item} className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
          はじめまして！
        </motion.h1>

        <motion.p variants={item} className="text-sm text-slate-500 mb-8 font-medium">
          表示名を設定してください
        </motion.p>

        <motion.form variants={item} onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            placeholder="お名前"
            maxLength={50}
            autoFocus
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
          >
            {loading ? '設定中...' : '決定'}
          </button>
        </motion.form>
      </motion.div>
    </div>
  );
}
