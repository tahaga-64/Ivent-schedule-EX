import { LogIn } from 'lucide-react';
import EXLogo from './EXLogo';

interface Props {
  onSignIn: () => void;
  onSkip: () => void;
  loading: boolean;
  error: string | null;
}

export default function LoginScreen({ onSignIn, onSkip, loading, error }: Props) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/mercury-office.webp)' }}
      />
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative flex flex-col items-center justify-center h-full px-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <EXLogo size="lg" showSubtitle={false} />

        <div className="mt-10 bg-white/95 backdrop-blur-sm rounded-2xl p-7 max-w-xs w-full shadow-2xl">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">EX EVENT MANAGEMENT</p>
          <h1 className="font-black text-xl text-slate-900 mb-5">管理者ログイン</h1>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs font-bold text-red-700 leading-snug">{error}</p>
            </div>
          )}

          <button
            onClick={onSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-sm transition-all shadow-md shadow-indigo-200 disabled:opacity-60 mb-3"
          >
            <LogIn size={16} strokeWidth={2.5} />
            {loading ? '認証中…' : 'Googleアカウントでログイン'}
          </button>

          <button
            onClick={onSkip}
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-sm font-bold transition-colors disabled:opacity-40"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
