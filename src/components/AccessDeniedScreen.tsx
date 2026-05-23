import { logout } from '../lib/firebase';

interface Props {
  email: string | null;
  onRetry: () => void;
}

export default function AccessDeniedScreen({ email, onRetry }: Props) {
  const handleSignOut = async () => {
    await logout();
    onRetry();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-2">アクセス権限がありません</h1>
        <p className="text-sm text-slate-500 mb-1">このアプリへのアクセスは制限されています。</p>
        {email && (
          <p className="text-xs text-slate-400 font-mono bg-slate-50 rounded-lg px-3 py-2 mb-6 break-all">
            {email}
          </p>
        )}
        <p className="text-xs text-slate-400 mb-6">
          アクセス許可が必要な場合は管理者にお問い合わせください。
        </p>
        <button
          onClick={handleSignOut}
          className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-colors"
        >
          別のアカウントでサインイン
        </button>
      </div>
    </div>
  );
}
