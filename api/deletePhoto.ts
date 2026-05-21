import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const CLOUD_NAME = 'dqwvmz3hk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { publicId } = req.body as { publicId?: string };
  if (!publicId) return res.status(400).json({ error: 'publicId is required' });

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Cloudinary is not configured (set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)' });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const body = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  });

  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await r.json() as { result: string };
  if (data.result !== 'ok' && data.result !== 'not found') {
    return res.status(500).json({ error: data.result });
  }
  res.json({ success: true });
}
