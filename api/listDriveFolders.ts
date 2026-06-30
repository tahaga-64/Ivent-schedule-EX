import type { VercelRequest, VercelResponse } from '@vercel/node';

// 自己完結（./lib/driveAuth を import すると Vercel で解決失敗し関数が落ちるため、
// 診断エンドポイントと同じく googleapis をこのファイル内で直接読み込む）。
export const config = { maxDuration: 30 };

const DEFAULT_FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID || '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

async function getDrive() {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client as never });
}

// 注: 読み取り専用かつフォルダIDは公開のため firebase-admin 認証は行わない。
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const drive = await getDrive();
    if (!drive) return res.status(503).json({ error: 'Google Drive is not configured' });

    const parentId = (req.query.parentId as string) || DEFAULT_FOLDER;
    const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const list = await drive.files.list({
      q,
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'name',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = (list.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name ?? '（名称なし）',
      modifiedTime: f.modifiedTime,
    }));

    return res.json({ parentId, folders });
  } catch (e) {
    console.error('listDriveFolders error:', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
