import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Bell, BellRing, BellOff } from 'lucide-react';
import {
  enablePushNotifications,
  getPushNotificationStatus,
  isPushNotificationConfigured,
  type PushNotificationStatus,
} from '../lib/pushNotifications';
import PushNotificationPanel from './PushNotificationPanel';

export default function PushNotificationButton({ user }: { user: User }) {
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
      setStatus(await getPushNotificationStatus());
    } finally {
      setBusy(false);
    }
  }, [busy, user]);

  if (!configured || status === null || status === 'unsupported') return null;

  const Icon = status === 'granted' ? BellRing : status === 'denied' ? BellOff : Bell;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setError(null); }}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors touch-manipulation"
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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] z-50 rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
            <PushNotificationPanel
              status={status}
              busy={busy}
              error={error}
              onEnable={handleEnable}
            />
          </div>
        </>
      )}
    </div>
  );
}
