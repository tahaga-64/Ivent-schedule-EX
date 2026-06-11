import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Bell, BellRing, BellOff, Loader2, Check } from 'lucide-react';
import {
  enablePushNotifications,
  getPushNotificationStatus,
  isPushNotificationConfigured,
  type PushNotificationStatus,
} from '../lib/pushNotifications';

// ヘッダーのベル。Push通知の購読（opt-in）UI。
// enablePushNotifications() を呼ぶ唯一の入口で、これが無いと端末が一切購読
// 登録されず Worker の /send は配信先 0 件になる。
export default function PushNotificationButton({ user }: { user: User }) {
  // Worker URL / 公開鍵が未設定（= インフラ未構築）なら、そもそも表示しない
  const configured = isPushNotificationConfigured();
  const [status, setStatus] = useState<PushNotificationStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    getPushNotificationStatus().then(s => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, [configured]);

  const handleEnable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await enablePushNotifications(user);
      setStatus('granted');
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知の有効化に失敗しました。');
      // 許可ダイアログで拒否された場合などに状態を取り直す
      setStatus(await getPushNotificationStatus());
    } finally {
      setBusy(false);
    }
  }, [busy, user]);

  // 未設定 / 非対応ブラウザ / 状態確認中 は非表示
  if (!configured || status === null || status === 'unsupported') return null;

  const Icon = status === 'granted' ? BellRing : status === 'denied' ? BellOff : Bell;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setError(null); }}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        title="プッシュ通知"
        aria-label="プッシュ通知の設定"
      >
        <Icon size={16} />
        {status === 'granted' && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
        )}
        {status === 'default' && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
        )}
      </button>

      {open && (
        <>
          {/* 外側クリックで閉じる */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 z-50 rounded-2xl border border-slate-200 bg-white shadow-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={15} className="text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">プッシュ通知</h3>
            </div>

            {status === 'granted' ? (
              <>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-2">
                  <Check size={14} /> この端末で有効です
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  イベントの追加や、自分が担当に追加されたときに通知が届きます。
                </p>
                <button
                  onClick={handleEnable}
                  disabled={busy}
                  className="w-full h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  この端末を再登録
                </button>
              </>
            ) : status === 'denied' ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                ブラウザでこのサイトの通知が
                <strong className="text-slate-800">ブロック</strong>
                されています。アドレスバーのサイト設定から通知を「許可」に変更し、ページを再読み込みしてください。
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  イベントの追加や、自分が担当に追加されたときにこの端末へ通知を届けます。
                </p>
                <button
                  onClick={handleEnable}
                  disabled={busy}
                  className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  通知を有効にする
                </button>
              </>
            )}

            {error && <p className="mt-2 text-[11px] text-red-600 leading-snug">{error}</p>}

            <p className="mt-3 text-[10px] text-slate-400 leading-snug">
              iPhone はホーム画面に追加したアプリから開くと有効化できます（iOS 16.4 以降）。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
