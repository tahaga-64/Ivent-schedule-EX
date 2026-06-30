import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DEFAULT_DRIVE_FOLDER_ID, getDriveClient } from './lib/driveAuth';

// コールドスタート（googleapis 読込）でタイムアウトしないよう上限を拡大
export const config = { maxDuration: 30 };

// 注: 読み取り専用かつフォルダIDは公開（フロントに埋め込み済み）のため、
// driveImage プロキシと同様に firebase-admin によるトークン検証は行わない。
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
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
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
