import { Bell, Loader2, Check, AlertCircle } from 'lucide-react';
import type { PushSetupState } from '../lib/pushNotifications';

interface Props {
  state: PushSetupState;
  busy: boolean;
  error: string | null;
  onEnable: () => void;
  compact?: boolean;
}

export default function PushNotificationPanel({ state, busy, error, onEnable, compact }: Props) {
  return (
    <div className={compact ? '' : 'text-left'}>
      {!compact && (
        <div className="flex items-center gap-2 mb-2">
          <Bell size={15} className="text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">プッシュ通知</h3>
        </div>
      )}

      {state === 'needs_pwa' ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900">iPhone で通知を受け取るには</strong>
            、Safari の共有メニュー（□↑）から「ホーム画面に追加」し、
            <strong className="text-slate-900">追加したアイコンから</strong>
            アプリを開いてから、もう一度「通知を有効にする」を押してください（iOS 16.4 以降）。
          </p>
          <p className="text-[10px] text-slate-400 leading-snug">
            通常の Safari タブではプッシュ通知は届きません。
          </p>
        </div>
      ) : state === 'subscribed' ? (
        <>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-2">
            <Check size={14} /> この端末で通知を受け取れます
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            イベントの追加・更新、担当追加、準備物・写真の変更などで通知が届きます。
          </p>
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            className="w-full h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            この端末を再登録
          </button>
        </>
      ) : state === 'permission_only' ? (
        <>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 mb-2">
            <AlertCircle size={14} /> 登録が未完了です
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            通知は許可されていますが、この端末がサーバーに登録されていません。下のボタンで登録を完了してください。
          </p>
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            登録を完了する
          </button>
        </>
      ) : state === 'denied' ? (
        <p className="text-xs text-slate-500 leading-relaxed">
          ブラウザでこのサイトの通知が
          <strong className="text-slate-800">ブロック</strong>
          されています。端末の設定またはアドレスバーのサイト設定から通知を「許可」に変更し、ページを再読み込みしてください。
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            イベントや準備物の変更を、この端末にリアルタイムでお知らせします。
          </p>
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            通知を有効にする
          </button>
        </>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600 leading-snug">{error}</p>}
    </div>
  );
}
