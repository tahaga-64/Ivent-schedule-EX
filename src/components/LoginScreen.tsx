import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { loginWithGoogle, loginWithApple, loginWithEmail } from '../lib/firebase';
import EXBadge from './EXBadge';
import HelpModal from './HelpModal';
import { HelpCircle } from 'lucide-react';

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const EMAIL_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています',
  'auth/user-not-found': 'このメールアドレスは登録されていません',
  'auth/wrong-password': 'パスワードが間違っています',
  'auth/too-many-requests': 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください',
  'auth/user-disabled': 'このアカウントは無効化されています',
};

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | 'email' | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    try {
      if (provider === 'apple') {
        await loginWithApple();
      } else {
        await loginWithGoogle();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setLoading('email');
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setEmailError(EMAIL_ERRORS[code] ?? 'ログインに失敗しました。もう一度お試しください');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background: MERCURY office photo */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage: "image-set(url('/mercury-office.webp') type('image/webp'), url('/mercury-office.jpg') type('image/jpeg'))",
        }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Card */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl px-10 py-10 max-w-sm w-full text-center shadow-[0_8px_40px_rgba(0,0,0,0.45)] relative z-10"
      >
        {/* EX logo */}
        <motion.div variants={item} className="mb-7 flex flex-col items-center gap-2.5">
          <EXBadge size={84} />
          <p className="text-sm font-medium text-white/70 tracking-[0.2em] uppercase">Event Manager</p>
        </motion.div>

        {/* Title */}
        <motion.p variants={item} className="text-2xl font-black text-white mb-8 tracking-tight">
          EX事業部 イベント管理システム
        </motion.p>

        {/* Login buttons */}
        <motion.div variants={item} className="flex flex-col gap-3">
          {/* Google login */}
          <button
            onClick={() => handleSocialLogin('google')}
            disabled={loading !== null}
            className="w-full py-4 bg-white text-indigo-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading === 'google' ? 'ログイン中...' : 'Googleでログイン'}
          </button>

          {/* Apple login */}
          <button
            onClick={() => handleSocialLogin('apple')}
            disabled={loading !== null}
            className="w-full py-4 bg-black text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black/80 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {loading === 'apple' ? 'ログイン中...' : 'Appleでログイン'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-[11px] text-white/40 font-medium">または</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Email login toggle */}
          <button
            type="button"
            onClick={() => { setShowEmailForm(v => !v); setEmailError(null); }}
            disabled={loading !== null}
            className="w-full py-3.5 bg-white/10 text-white/80 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/20 active:scale-[0.98] transition-all disabled:opacity-60 border border-white/20"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 7L2 7" />
            </svg>
            メールアドレスでログイン
          </button>

          {/* Email/password form */}
          <AnimatePresence>
            {showEmailForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleEmailLogin}
                className="flex flex-col gap-2 overflow-hidden"
              >
                <input
                  type="email"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/60 transition-colors"
                />
                <input
                  type="password"
                  placeholder="パスワード"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/60 transition-colors"
                />
                {emailError && (
                  <p className="text-[11px] text-red-300 text-left px-1">{emailError}</p>
                )}
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-400 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg mt-1"
                >
                  {loading === 'email' ? 'ログイン中...' : 'ログイン'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer note */}
        <motion.p variants={item} className="text-[11px] text-white/40 mt-6">
          許可されたアカウントのみアクセス可能です
        </motion.p>
        <motion.button
          variants={item}
          type="button"
          onClick={() => setShowHelp(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-white/70 hover:text-white underline underline-offset-2 transition-colors"
        >
          <HelpCircle size={13} />
          使い方ガイドを見る
        </motion.button>
      </motion.div>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
