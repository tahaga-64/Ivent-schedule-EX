import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

/**
 * Firestore `allowedUsers` コレクションでログイン許可チェック。
 *
 * ドキュメントはメールアドレスまたはUIDをIDとして追加する:
 *   allowedUsers/{email}  例: taoki0183@gmail.com
 *   allowedUsers/{uid}    例: abc123xyz（UIDが判明した後に追加可）
 *
 * Firebase Consoleで手動追加する（クライアントから書き込み不可）。
 */
export async function checkUserAllowed(user: User): Promise<boolean> {
  if (!user.email) return false;

  // メールアドレスで検索（主要な方法）
  const emailDoc = await getDoc(doc(db, 'allowedUsers', user.email));
  if (emailDoc.exists()) return true;

  // UIDで検索（将来のUID追加に対応）
  const uidDoc = await getDoc(doc(db, 'allowedUsers', user.uid));
  return uidDoc.exists();
}
