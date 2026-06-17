import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDriveClient, isAuthenticated } from './lib/driveAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const drive = await getDriveClient();
  if (!drive) {
    return res.status(503).json({ error: 'Google Drive is not configured' });
  }

  const { driveFileId } = req.body as { driveFileId?: string };
  if (!driveFileId) {
    return res.status(400).json({ error: 'driveFileId is required' });
  }

  try {
    await drive.files.delete({ fileId: driveFileId });
    return res.json({ success: true });
  } catch (e) {
    console.error('deleteDriveFile error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
