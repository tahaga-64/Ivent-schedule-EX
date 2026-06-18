import { GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, ensureAnonymousAuth } from './firebase';
import { exAuth, ensureAnonymousExAuth } from './exSchedule';
import { EVENT_EDITOR_EMAILS } from './permissions';

const provider = new GoogleAuthProvider();

function isEventEditorEmail(email: string | null | undefined): boolean {
  return !!email && EVENT_EDITOR_EMAILS.includes(email);
}

/**
 * モバイル管理者ログイン: メイン auth と EX-schedule exAuth の両方で Google サインイン。
 * EVENT_EDITOR_EMAILS に無いアカウントは即サインアウトしてエラーを返す。
 */
export async function signInAsAdmin(): Promise<User> {
  const mainResult = await signInWithPopup(auth, provider);
  const user = mainResult.user;

  if (!isEventEditorEmail(user.email)) {
    await signOutAdmin();
    throw new Error('編集権限がありません。登録済みの管理者アカウントでログインしてください。');
  }

  try {
    const credential = GoogleAuthProvider.credentialFromResult(mainResult);
    if (!credential) {
      throw new Error('Google 認証情報の取得に失敗しました。');
    }
    await signInWithCredential(exAuth, credential);
  } catch (e) {
    await signOut(auth).catch(() => {});
    await ensureAnonymousAuth().catch(() => {});
    throw e instanceof Error ? e : new Error('スケジュール用の認証に失敗しました。');
  }

  return user;
}

/** 管理者ログアウト → 匿名閲覧モードに復帰 */
export async function signOutAdmin(): Promise<void> {
  await Promise.all([
    signOut(exAuth).catch(() => {}),
    signOut(auth).catch(() => {}),
  ]);
  await Promise.all([
    ensureAnonymousAuth(),
    ensureAnonymousExAuth(),
  ]);
}

export function isMobileAdminUser(user: User | null | undefined): boolean {
  return !!user && !user.isAnonymous && isEventEditorEmail(user.email);
}
