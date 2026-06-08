import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const CLOUD_NAME = 'dqwvmz3hk';

let adminApp: App | null = null;

/** FIREBASE_SERVICE_ACCOUNT_JSON から firebase-admin を初期化（未設定なら null）。 */
function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw);
    adminApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    return adminApp;
  } catch (e) {
    console.error('firebase-admin の初期化に失敗しました:', e);
    return null;
  }
}

/** Authorization: Bearer <Firebase ID Token> を検証。ログイン済みユーザーのみ true。 */
async function isAuthenticated(req: VercelRequest): Promise<boolean> {
  const app = getAdminApp();
  if (!app) return false; // サービスアカウント未設定 → fail closed
  const header = req.headers.authorization ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  try {
    await getAuth(app).verifyIdToken(match[1]);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Cloudinary is not configured (set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)' });
  }

  // 認証必須: サービスアカウント未設定/トークン不正は拒否（不正な画像削除を防止）
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({ error: 'Authentication is not configured (set FIREBASE_SERVICE_ACCOUNT_JSON)' });
  }
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { publicId } = req.body as { publicId?: string };
  if (!publicId) return res.status(400).json({ error: 'publicId is required' });

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
