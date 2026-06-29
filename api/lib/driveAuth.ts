import type { VercelRequest } from '@vercel/node';

export const DEFAULT_DRIVE_FOLDER_ID = '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

// 重い依存（firebase-admin / googleapis）はモジュール先頭ではなく、
// 関数内で動的 import する。これにより:
//  - コールドスタート時の読込クラッシュが handler の try/catch で捕捉できる
//  - 関数モジュール自体のロードが軽くなる
// ※ パッケージ名の動的 import は ESM でも拡張子不要で解決できる（相対パスと異なる）。

let adminAppPromise: Promise<unknown> | null = null;

async function getAdminApp(): Promise<unknown> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { cert, getApps, initializeApp } = await import('firebase-admin/app');
      const serviceAccount = JSON.parse(raw);
      return getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    })();
  }
  return adminAppPromise;
}

export async function isAuthenticated(req: VercelRequest): Promise<boolean> {
  let app: unknown;
  try {
    app = await getAdminApp();
  } catch (e) {
    adminAppPromise = null;
    console.error('firebase-admin init failed:', e);
    return false;
  }
  if (!app) return false;

  const header = req.headers.authorization ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  try {
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth(app as never).verifyIdToken(match[1]);
    return true;
  } catch {
    return false;
  }
}

export async function getDriveClient() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const { google } = await import('googleapis');
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client as never });
}

export function sanitizeDriveName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'untitled';
}
