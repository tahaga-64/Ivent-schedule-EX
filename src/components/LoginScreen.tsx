import { useState } from 'react';
import { motion } from 'motion/react';
import { loginWithGoogle } from '../lib/firebase';
import EXLogo from './EXLogo';

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
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
        {/* EX logo */}
        <motion.div variants={item} className="mb-7 flex justify-center">
          <EXLogo size="md" showSubtitle />
        </motion.div>

        {/* Title */}
        <motion.h1 variants={item} className="text-2xl font-black text-white mb-1 tracking-tight">
          Ivent Manager
        </motion.h1>

        {/* Subtitle */}
        <motion.p variants={item} className="text-sm text-white/60 mb-8 font-medium">
          EX事業部 イベント管理システム
        </motion.p>

        {/* Google login button */}
        <motion.div variants={item}>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 bg-white text-indigo-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'ログイン中...' : 'Googleでログイン'}
          </button>
        </motion.div>

        {/* Footer note */}
        <motion.p variants={item} className="text-[11px] text-white/40 mt-6">
          Googleアカウントでのみアクセス可能です
        </motion.p>
      </motion.div>
    </div>
  );
}
