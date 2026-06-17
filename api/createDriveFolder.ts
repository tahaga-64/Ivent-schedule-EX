import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DEFAULT_DRIVE_FOLDER_ID, getDriveClient, isAuthenticated, sanitizeDriveName } from './lib/driveAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

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

  const { name, parentId } = req.body as { name?: string; parentId?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const folderParent = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;

  try {
    const created = await drive.files.create({
      requestBody: {
        name: sanitizeDriveName(name),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderParent],
      },
      fields: 'id,name,webViewLink',
    });

    if (!created.data.id) {
      return res.status(500).json({ error: 'Failed to create folder' });
    }

    return res.json({
      id: created.data.id,
      name: created.data.name,
      webViewLink: created.data.webViewLink,
    });
  } catch (e) {
    console.error('createDriveFolder error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
