import { useState } from 'react';
import { User } from 'firebase/auth';
import { Bell, BellRing, BellOff } from 'lucide-react';
import { usePushSetup } from '../hooks/usePushSetup';
import PushNotificationPanel from './PushNotificationPanel';

export default function PushNotificationButton({ user }: { user: User }) {
  const { configured, state, busy, error, enable, setError } = usePushSetup(user);
  const [open, setOpen] = useState(false);

  if (!configured || state === null || state === 'unsupported') return null;

  const Icon = state === 'subscribed' ? BellRing : state === 'denied' ? BellOff : Bell;
  const dotClass =
    state === 'subscribed' ? 'bg-emerald-500' :
    state === 'permission_only' || state === 'prompt' || state === 'needs_pwa' ? 'bg-amber-500' :
    null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setError(null); }}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors touch-manipulation"
        title="プッシュ通知"
        aria-label="プッシュ通知の設定"
      >
        <Icon size={18} />
        {dotClass && (
          <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${dotClass}`} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] z-50 rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
            <PushNotificationPanel
              state={state}
              busy={busy}
              error={error}
              onEnable={enable}
            />
          </div>
        </>
      )}
    </div>
  );
}
