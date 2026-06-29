import type { VercelRequest, VercelResponse } from '@vercel/node';

// コールドスタート（googleapis/firebase-admin の読込）で 10秒既定を超えないよう上限を拡大
export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }

  try {
    // 重い依存は動的 import（読込時の例外もここで捕捉して可読化する）
    const { DEFAULT_DRIVE_FOLDER_ID, getDriveClient, isAuthenticated } = await import('./lib/driveAuth');

    if (!(await isAuthenticated(req))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const drive = await getDriveClient();
    if (!drive) {
      return res.status(503).json({ error: 'Google Drive is not configured' });
    }

    const parentId = (req.query.parentId as string) || process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
    const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const list = await drive.files.list({
      q,
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'name',
      pageSize: 200,
    });

    const folders = (list.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name ?? '（名称なし）',
      modifiedTime: f.modifiedTime,
    }));

    return res.json({ parentId, folders });
  } catch (e) {
    console.error('listDriveFolders error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
