import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  enablePushNotifications,
  getPushSetupState,
  isPushNotificationConfigured,
  syncPushSubscriptionIfGranted,
  type PushSetupState,
} from '../lib/pushNotifications';

export function usePushSetup(user: User | null | undefined) {
  const configured = isPushNotificationConfigured();
  const [state, setState] = useState<PushSetupState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) {
      setState('unsupported');
      return;
    }
    setState(await getPushSetupState());
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    getPushSetupState().then(s => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [configured, user?.uid]);

  useEffect(() => {
    if (!user || !configured) return;
    syncPushSubscriptionIfGranted(user).then(ok => {
      if (ok) refresh();
    });
  }, [user, configured, refresh]);

  const enable = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await enablePushNotifications(user);
      setState(await getPushSetupState());
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知の有効化に失敗しました。');
      setState(await getPushSetupState());
    } finally {
      setBusy(false);
    }
  }, [busy, user]);

  return { configured, state, busy, error, enable, refresh, setError };
}
