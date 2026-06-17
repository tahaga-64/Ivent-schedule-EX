import type { VercelRequest } from '@vercel/node';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { google } from 'googleapis';

export const DEFAULT_DRIVE_FOLDER_ID = '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

let adminApp: App | null = null;

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw);
    adminApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    return adminApp;
  } catch (e) {
    console.error('firebase-admin init failed:', e);
    return null;
  }
}

export async function isAuthenticated(req: VercelRequest): Promise<boolean> {
  const app = getAdminApp();
  if (!app) return false;
  const header = req.headers.authorization ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  try {
    await getAuth(app).verifyIdToken(match[1]);
    return true;
  } catch {
    return false;
  }
}

export function getDriveAuth() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });
  } catch (e) {
    console.error('Google Drive auth init failed:', e);
    return null;
  }
}

export async function getDriveClient() {
  const driveAuth = getDriveAuth();
  if (!driveAuth) return null;
  const auth = await driveAuth.getClient();
  return google.drive({ version: 'v3', auth: auth as never });
}

export function sanitizeDriveName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'untitled';
}
