import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { X, Bell } from 'lucide-react';
import {
  enablePushNotifications,
  getPushNotificationStatus,
  isPushNotificationConfigured,
  type PushNotificationStatus,
} from '../lib/pushNotifications';
import { needsPwaInstallForPush } from '../lib/pushDeviceSupport';
import PushNotificationPanel from './PushNotificationPanel';

const DISMISS_KEY = 'push-banner-dismissed-v1';

interface Props {
  user: User;
}

/** スマホ向け：通知未設定時に画面下部（ナビ直上）で案内 */
export default function MobilePushBanner({ user }: Props) {
  const configured = isPushNotificationConfigured();
  const [status, setStatus] = useState<PushNotificationStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    getPushNotificationStatus().then(s => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, [configured]);

  const handleEnable = useCallback(async () => {
    if (busy || needsPwaInstallForPush()) return;
    setBusy(true);
    setError(null);
    try {
      await enablePushNotifications(user);
      setStatus('granted');
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知の有効化に失敗しました。');
      setStatus(await getPushNotificationStatus());
    } finally {
      setBusy(false);
    }
  }, [busy, user]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (!configured || status === null || status === 'unsupported') return null;
  if (status === 'granted' || status === 'denied') return null;
  if (dismissed && !needsPwaInstallForPush()) return null;

  if (!expanded) {
    return (
      <div
        className="fixed left-0 right-0 z-[25] md:hidden px-3"
        style={{ bottom: 'calc(3.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 shadow-lg px-3 py-2.5">
          <Bell size={18} className="text-indigo-600 shrink-0" />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex-1 text-left text-xs font-bold text-indigo-900 leading-snug"
          >
            {needsPwaInstallForPush()
              ? 'iPhone：ホーム画面に追加すると通知を受け取れます'
              : 'プッシュ通知を有効にして変更をお知らせ'}
          </button>
          {!needsPwaInstallForPush() && (
            <button
              type="button"
              onClick={dismiss}
              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100"
              aria-label="閉じる"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-0 right-0 z-[25] md:hidden px-3"
      style={{ bottom: 'calc(3.25rem + env(safe-area-inset-bottom))' }}
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>
        <PushNotificationPanel
          status={status}
          busy={busy}
          error={error}
          onEnable={handleEnable}
          compact
        />
      </div>
    </div>
  );
}
