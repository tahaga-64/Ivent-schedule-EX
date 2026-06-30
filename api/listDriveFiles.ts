import type { VercelRequest, VercelResponse } from '@vercel/node';

// 自己完結（./lib/driveAuth を import すると Vercel で解決失敗し関数が落ちるため、
// 診断エンドポイントと同じく googleapis をこのファイル内で直接読み込む）。
export const config = { maxDuration: 30 };

const DEFAULT_FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID || '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

// Drive クライアントは関数インスタンス内で再利用（毎リクエストの認証を省略し高速化）
let _drivePromise: ReturnType<typeof buildDrive> | null = null;
function getDrive() {
  if (!_drivePromise) _drivePromise = buildDrive().catch(e => { _drivePromise = null; throw e; });
  return _drivePromise;
}
async function buildDrive() {
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

/**
 * 指定フォルダ直下の画像ファイル一覧を返す（アルバムのDriveミラー表示用）。
 * GET /api/listDriveFiles?folderId=...&pageToken=...
 * 注: 読み取り専用かつフォルダIDは公開のため firebase-admin 認証は行わない。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const drive = await getDrive();
    if (!drive) return res.status(503).json({ error: 'Google Drive is not configured' });

    // 入力（公開）をクエリに直接埋め込むため、Drive ID 形式のみ許可（クエリ混入防止）
    const rawFolderId = Array.isArray(req.query.folderId) ? req.query.folderId[0] : req.query.folderId;
    const folderId = rawFolderId || DEFAULT_FOLDER;
    if (!/^[A-Za-z0-9_-]+$/.test(folderId)) {
      return res.status(400).json({ error: 'invalid folderId' });
    }
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
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
