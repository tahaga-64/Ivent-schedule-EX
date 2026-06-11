import { useState } from 'react';
import { User } from 'firebase/auth';
import { X, Bell } from 'lucide-react';
import { usePushSetup } from '../hooks/usePushSetup';
import PushNotificationPanel from './PushNotificationPanel';

const DISMISS_KEY = 'push-banner-dismissed-v2';

interface Props {
  user: User;
}

/** スマホ向け：未購読時に画面下部（ナビ直上）で案内 */
export default function MobilePushBanner({ user }: Props) {
  const { configured, state, busy, error, enable, setError } = usePushSetup(user);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (!configured || state === null || state === 'unsupported') return null;
  if (state === 'subscribed' || state === 'denied') return null;

  const mustShow = state === 'needs_pwa' || state === 'permission_only';
  if (dismissed && !mustShow) return null;

  const bannerText =
    state === 'needs_pwa'
      ? 'iPhone：ホーム画面に追加してから通知を有効に'
      : state === 'permission_only'
        ? '通知の登録が未完了です。タップして完了'
        : 'プッシュ通知を有効にして変更をお知らせ';

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
            {bannerText}
          </button>
          {!mustShow && (
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
          state={state}
          busy={busy}
          error={error}
          onEnable={enable}
          compact
        />
      </div>
    </div>
  );
}
