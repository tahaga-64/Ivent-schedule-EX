import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { google } from 'googleapis';

const DEFAULT_FOLDER_ID = '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

let adminApp: App | null = null;

function getAdminApp(): App | null {
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

async function isAuthenticated(req: VercelRequest): Promise<boolean> {
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

function getDriveAuth() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } catch (e) {
    console.error('Google Drive auth init failed:', e);
    return null;
  }
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'event';
}

async function findOrCreateEventFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  folderName: string,
): Promise<string> {
  const escaped = folderName.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`;
  const list = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
  const existing = list.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  if (!created.data.id) throw new Error('Failed to create Drive subfolder');
  return created.data.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
  const driveAuth = getDriveAuth();
  if (!driveAuth) {
    return res.status(503).json({ error: 'Google Drive is not configured' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { imageUrl, eventId, venue, start, fileName } = req.body as {
    imageUrl?: string;
    eventId?: string;
    venue?: string;
    start?: string;
    fileName?: string;
  };

  if (!imageUrl || !eventId) {
    return res.status(400).json({ error: 'imageUrl and eventId are required' });
  }

  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return res.status(400).json({ error: 'Failed to fetch image from imageUrl' });
    }
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
    const safeName = fileName?.replace(/[\\/:*?"<>|]/g, '_') || `${Date.now()}.jpg`;

    const auth = await driveAuth.getClient();
    const drive = google.drive({ version: 'v3', auth });

    const subfolderName = sanitizeFolderName(`${venue || 'event'}_${start || eventId}`);
    const eventFolderId = await findOrCreateEventFolder(drive, folderId, subfolderName);

    const uploaded = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: [eventFolderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = uploaded.data.id;
    if (!fileId) {
      return res.status(500).json({ error: 'Drive upload succeeded but file id missing' });
    }

    // 共有リンク閲覧用（サービスアカウント所有ファイルをリンク知っている人が閲覧可）
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch (permErr) {
      console.warn('Drive permission set failed (file still uploaded):', permErr);
    }

    const meta = await drive.files.get({ fileId, fields: 'webViewLink, webContentLink' });

    return res.json({
      fileId,
      webViewLink: meta.data.webViewLink ?? uploaded.data.webViewLink,
      webContentLink: meta.data.webContentLink ?? uploaded.data.webContentLink,
      folderId: eventFolderId,
    });
  } catch (e) {
    console.error('Drive upload error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
