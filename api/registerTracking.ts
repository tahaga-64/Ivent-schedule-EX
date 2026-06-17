import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthenticated } from './lib/driveAuth';
import { getTrack17ApiKey, track17Register } from './lib/track17';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!getTrack17ApiKey()) {
    return res.status(503).json({ error: 'Tracking API is not configured' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { trackingNumber, carrierCode } = req.body as {
    trackingNumber?: string;
    carrierCode?: string;
  };

  if (!trackingNumber?.trim()) {
    return res.status(400).json({ error: 'trackingNumber is required' });
  }

  const carrier = carrierCode ? parseInt(carrierCode, 10) : undefined;
  const result = await track17Register([{
    number: trackingNumber.trim(),
    ...(carrier != null && !Number.isNaN(carrier) ? { carrier } : {}),
  }]);

  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }

  return res.json({ success: true, data: result.data });
}
