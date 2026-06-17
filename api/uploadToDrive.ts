import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';
import { getDriveClient, isAuthenticated, sanitizeDriveName } from './lib/driveAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const drive = await getDriveClient();
  if (!drive) {
    return res.status(503).json({ error: 'Google Drive is not configured' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { eventId, targetFolderId, fileName, mimeType, fileData, imageUrl } = req.body as {
    eventId?: string;
    targetFolderId?: string;
    fileName?: string;
    mimeType?: string;
    fileData?: string;
    imageUrl?: string;
  };

  if (!eventId || !targetFolderId) {
    return res.status(400).json({ error: 'eventId and targetFolderId are required' });
  }
  if (!fileData && !imageUrl) {
    return res.status(400).json({ error: 'fileData or imageUrl is required' });
  }

  try {
    let buffer: Buffer;
    let contentType: string;

    if (fileData) {
      buffer = Buffer.from(fileData, 'base64');
      contentType = mimeType || 'image/jpeg';
    } else {
      const imageRes = await fetch(imageUrl!);
      if (!imageRes.ok) {
        return res.status(400).json({ error: 'Failed to fetch image from imageUrl' });
      }
      buffer = Buffer.from(await imageRes.arrayBuffer());
      contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    }

    const safeName = sanitizeDriveName(fileName || `${Date.now()}.jpg`);

    const uploaded = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: contentType,
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink, webContentLink, thumbnailLink',
    });

    const fileId = uploaded.data.id;
    if (!fileId) {
      return res.status(500).json({ error: 'Drive upload succeeded but file id missing' });
    }

    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch (permErr) {
      console.warn('Drive permission set failed (file still uploaded):', permErr);
    }

    const meta = await drive.files.get({
      fileId,
      fields: 'webViewLink, webContentLink, thumbnailLink',
    });

    return res.json({
      fileId,
      webViewLink: meta.data.webViewLink ?? uploaded.data.webViewLink,
      webContentLink: meta.data.webContentLink ?? uploaded.data.webContentLink,
      thumbnailLink: meta.data.thumbnailLink ?? uploaded.data.thumbnailLink,
      folderId: targetFolderId,
    });
  } catch (e) {
    console.error('Drive upload error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
