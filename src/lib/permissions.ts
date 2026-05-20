import type { User } from 'firebase/auth';

/**
 * イベント本体の編集・削除・写真アップロード等に使うアカウント（従来の「編集者数名のみ」）。
 * Firestore のイベント書き込みポリシーと揃えること。
 */
export const EVENT_EDITOR_EMAILS: readonly string[] = [
  'taoki0183@gmail.com',
  'haruhito3901@gmail.com',
  'm.takada.kp@gmail.com',
];

function isSignedIn(user: User | null | undefined): user is User {
  return user != null;
}

/** イベントドキュメント／写真など「限定編集者」の UI 可否 */
export function canEditEvent(user: User | null | undefined, isMobile = false): boolean {
  if (isMobile) return false;
  if (!isSignedIn(user)) return false;
  const email = user.email;
  if (!email) return false;
  return EVENT_EDITOR_EMAILS.includes(email);
}

/** 写真アップロード・削除は編集者メールならモバイルでも可 */
export function canUploadPhoto(user: User | null | undefined): boolean {
  if (!isSignedIn(user)) return false;
  const email = user.email;
  if (!email) return false;
  return EVENT_EDITOR_EMAILS.includes(email);
}

export function canEditPreparationList(user: User | null | undefined, isMobile = false): boolean {
  return isSignedIn(user);
}
