import type { VercelRequest, VercelResponse } from '@vercel/node';

// 自己完結（./lib/driveAuth を import すると Vercel で解決失敗し関数が落ちるため、
// 診断エンドポイントと同じく googleapis をこのファイル内で直接読み込む）。
export const config = { maxDuration: 30 };

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
 * Drive 画像をサーバー（サービスアカウント）経由で配信するプロキシ。
 * GET /api/driveImage?id=<fileId>&size=thumb|full
 * 内容不変なので強キャッシュ。<img src> から読むため認証は付けない（画像MIMEのみ許可）。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const id = (req.query.id as string) || '';
  const size = (req.query.size as string) === 'thumb' ? 'thumb' : 'full';
  if (!id) return res.status(400).json({ error: 'missing id' });

  try {
    const drive = await getDrive();
    if (!drive) return res.status(503).json({ error: 'Google Drive is not configured' });

    const meta = await drive.files.get({
      fileId: id,
      fields: 'id,mimeType,thumbnailLink,trashed',
      supportsAllDrives: true,
    });
    const file = meta.data;
    if (!file || file.trashed) return res.status(404).end();
    const mime = file.mimeType || '';
    if (!mime.startsWith('image/')) return res.status(415).json({ error: 'not an image' });

    const cache = 'public, max-age=31536000, immutable';

    if (size === 'thumb' && file.thumbnailLink) {
      // グリッド用サムネは小さめ（=s400）で軽量・高速に
      const thumbUrl = file.thumbnailLink
        .replace(/=s\d+$/, '=s400')
        .replace(/=w\d+-h\d+(-[a-z]+)?$/, '=s400');
      const r = await fetch(thumbUrl);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', cache);
        return res.send(buf);
      }
    }

    const media = await drive.files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );
    const buf = Buffer.from(media.data as ArrayBuffer);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', cache);
    return res.send(buf);
  } catch (e) {
    console.error('driveImage error:', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
