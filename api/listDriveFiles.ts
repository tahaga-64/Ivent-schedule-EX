import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DEFAULT_DRIVE_FOLDER_ID, getDriveClient } from './lib/driveAuth';

// コールドスタート（googleapis 読込）でタイムアウトしないよう上限を拡大
export const config = { maxDuration: 30 };

/**
 * 指定フォルダ直下の画像ファイル一覧を返す（アルバムのDriveミラー表示用）。
 * GET /api/listDriveFiles?folderId=...&pageToken=...
 *
 * 注: 読み取り専用かつフォルダIDは公開のため、driveImage プロキシと同様に
 * firebase-admin によるトークン検証は行わない。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const drive = await getDriveClient();
    if (!drive) {
      return res.status(503).json({ error: 'Google Drive is not configured' });
    }

    const folderId = (req.query.folderId as string) || process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
    const pageToken = (req.query.pageToken as string) || undefined;

    const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`;
    const list = await drive.files.list({
      q,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,imageMediaMetadata(width,height))',
      orderBy: 'modifiedTime desc',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = (list.data.files ?? []).map(f => ({
      id: f.id!,
      name: f.name ?? '（名称なし）',
      mimeType: f.mimeType ?? '',
      modifiedTime: f.modifiedTime ?? '',
      width: f.imageMediaMetadata?.width ?? null,
      height: f.imageMediaMetadata?.height ?? null,
    }));

    return res.json({ folderId, files, nextPageToken: list.data.nextPageToken ?? null });
  } catch (e) {
    console.error('listDriveFiles error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
