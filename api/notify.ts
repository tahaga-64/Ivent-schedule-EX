import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

function ensureAdmin(): void {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw === 'undefined') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount),
  });
}

/**
 * Vercel サーバーレス上で FCM マルチキャスト送信（Firebase の無料枠内）。
 * 環境変数 FIREBASE_SERVICE_ACCOUNT_JSON にサービスアカウント JSON を設定する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    ensureAdmin();
  } catch {
    return res.status(503).json({
      error: 'Push server is not configured (set FIREBASE_SERVICE_ACCOUNT_JSON on the host).',
    });
  }

  const { title, body } = req.body as { title: string; body: string };
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

  const db = admin.firestore();
  const snap = await db.collection('users').get();
  const tokens = snap.docs.map((d) => d.data().fcmToken as string).filter(Boolean);

  if (tokens.length === 0) return res.json({ sent: 0 });

  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
  });
  res.json({ sent: result.successCount, failed: result.failureCount });
}
