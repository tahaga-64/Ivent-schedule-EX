import { useCallback, useEffect, useState } from 'react';

const KEY = 'ex_user_name';

/**
 * ログイン廃止に伴う簡易な利用者名。
 * パスワード無し・端末の localStorage に保存し、変更履歴の「誰が」に使う。
 */
export function useUserName() {
  const [name, setNameState] = useState<string>(() => {
    try { return localStorage.getItem(KEY)?.trim() || ''; } catch { return ''; }
  });

  const setName = useCallback((value: string) => {
    const v = value.trim();
    setNameState(v);
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }, []);

  // 他タブ・他ウィンドウとの同期
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setNameState(e.newValue?.trim() || '');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { name, setName, hasName: !!name };
}
