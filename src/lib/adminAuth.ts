import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, ensureAnonymousAuth } from './firebase';
import { exAuth, ensureAnonymousExAuth } from './exSchedule';
import { EVENT_EDITOR_EMAILS } from './permissions';

const provider = new GoogleAuthProvider();

function isEventEditorEmail(email: string | null | undefined): boolean {
  return !!email && EVENT_EDITOR_EMAILS.includes(email);
}

const isMobileBrowser = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

async function completeAdminSignIn(result: UserCredential): Promise<User> {
  const user = result.user;

  if (!isEventEditorEmail(user.email)) {
    await signOutAdmin();
    throw new Error('編集権限がありません。登録済みの管理者アカウントでログインしてください。');
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential) {
    await signInWithCredential(exAuth, credential).catch(() => {
      // exAuth sign-in failure is non-fatal; schedule may be read-only
    });
  }

  return user;
}

/**
 * モバイル: Google リダイレクトでサインイン（ページリロード後に getAdminRedirectResult で完了）
 * PC: ポップアップでサインイン
 */
export async function signInAsAdmin(): Promise<User> {
  if (isMobileBrowser()) {
    await signInWithRedirect(auth, provider);
    // リダイレクト後はページリロードのためここには到達しない
    throw new Error('リダイレクト中...');
  }

  try {
    const result = await signInWithPopup(auth, provider);
    return completeAdminSignIn(result);
  } catch (e: any) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user') {
      // ポップアップが閉じられた/ブロックされた場合はリダイレクトにフォールバック
      await signInWithRedirect(auth, provider);
      throw new Error('リダイレクト中...');
    }
    throw e instanceof Error ? e : new Error('ログインに失敗しました。');
  }
}

/**
 * ページ読み込み時にリダイレクト結果を確認してサインインを完了する。
 * リダイレクト結果がない場合は null を返す。
 */
export async function getAdminRedirectResult(): Promise<User | null> {
  const result = await getRedirectResult(auth).catch(() => null);
  if (!result) return null;
  return completeAdminSignIn(result);
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
