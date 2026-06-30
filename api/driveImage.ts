import type { VercelRequest, VercelResponse } from '@vercel/node';

// コールドスタート（googleapis の読込）で 10秒既定を超えないよう上限を拡大
export const config = { maxDuration: 30 };

// コールドスタート（googleapis の読込）で 10秒既定を超えないよう上限を拡大
export const config = { maxDuration: 30 };

// コールドスタート（googleapis の読込）で 10秒既定を超えないよう上限を拡大
export const config = { maxDuration: 30 };

/**
 * Drive 画像をサーバー（サービスアカウント）経由で配信するプロキシ。
 * GET /api/driveImage?id=<fileId>&size=thumb|full
 *
 * 注: <img src> から読み込むため Firebase トークン認証は付けられない。
 * その代わり「画像 MIME のファイルのみ」に限定し、内容不変なので強キャッシュする。
 * Drive のファイルID自体が高エントロピーで推測困難（現行 Cloudinary の公開URLと同等のモデル）。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const id = (req.query.id as string) || '';
  const size = (req.query.size as string) === 'thumb' ? 'thumb' : 'full';
  if (!id) return res.status(400).json({ error: 'missing id' });

  try {
    const { getDriveClient } = await import('./lib/driveAuth');
    const drive = await getDriveClient();
    if (!drive) return res.status(503).json({ error: 'Google Drive is not configured' });

    const meta = await drive.files.get({
      fileId: id,
      fields: 'id,mimeType,thumbnailLink,trashed',
    });
    const file = meta.data;
    if (!file || file.trashed) return res.status(404).end();
    const mime = file.mimeType || '';
    if (!mime.startsWith('image/')) return res.status(415).json({ error: 'not an image' });

    const cache = 'public, max-age=31536000, immutable';

    // サムネイル: Drive の thumbnailLink をサイズ指定して取得（軽量）
    if (size === 'thumb' && file.thumbnailLink) {
      const thumbUrl = file.thumbnailLink
        .replace(/=s\d+$/, '=s800')
        .replace(/=w\d+-h\d+(-[a-z]+)?$/, '=s800');
      const r = await fetch(thumbUrl);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', cache);
        return res.send(buf);
      }
      // サムネ取得に失敗したら原本にフォールバック
    }

    // 原本: alt=media でバイト列を取得（サービスアカウントで確実に読める）
    const media = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    const buf = Buffer.from(media.data as ArrayBuffer);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', cache);
    return res.send(buf);
  } catch (e) {
    console.error('driveImage error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
