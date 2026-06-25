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
      // Worker登録に失敗してもブラウザのローカル購読は残るため getPushSetupState() が
      // 'subscribed' を返し、バナーが消えてエラーが隠れてしまう（KVには未登録のまま）。
      // 登録未完了として扱い、バナーとエラーを表示し続ける。
      const s = await getPushSetupState();
      setState(s === 'subscribed' ? 'permission_only' : s);
    } finally {
      setBusy(false);
    }
  }, [busy, user]);

  return { configured, state, busy, error, enable, refresh, setError };
}
