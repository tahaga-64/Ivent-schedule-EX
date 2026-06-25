import { useState } from 'react';
import { UserRound } from 'lucide-react';

interface Props {
  open: boolean;
  initial?: string;
  /** スタッフ名の候補（datalist 補完用） */
  staffNames?: string[];
  /** 初回（名前未設定）は必須にして閉じられないようにする */
  required?: boolean;
  onSubmit: (name: string) => void;
  onClose?: () => void;
}

/**
 * 利用者名の入力/変更モーダル。ログイン廃止の代わりに「誰が変更したか」を記録するための簡易な名前。
 * パスワードは不要。スタッフ名から選んでも自由入力でもよい。
 */
export default function NamePrompt({
  open,
  initial = '',
  staffNames = [],
  required = false,
  onSubmit,
  onClose,
}: Props) {
  const [value, setValue] = useState(initial);
  if (!open) return null;

  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!required) onClose?.(); }}
      />
      <div className="relative w-full max-w-xs bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <UserRound size={18} className="text-indigo-600" />
          <h2 className="font-black text-base text-slate-900">お名前を入力</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">変更履歴に表示されます。パスワードは不要です。</p>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
          list="nameprompt-staff-options"
          placeholder="例：山田"
          autoFocus
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-400 text-slate-900"
          style={{ fontSize: '16px' }}
        />
        {staffNames.length > 0 && (
          <datalist id="nameprompt-staff-options">
            {staffNames.map(n => <option key={n} value={n} />)}
          </datalist>
        )}
        <div className="flex gap-2 mt-5">
          {!required && (
            <button
              type="button"
              onClick={() => onClose?.()}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black disabled:opacity-50 transition-colors"
          >
            決定
          </button>
        </div>
      </div>
    </div>
  );
}
