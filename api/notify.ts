import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)
    ),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { title, body } = req.body as { title: string; body: string };
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

  const db = admin.firestore();
  const snap = await db.collection('users').get();
  const tokens = snap.docs.map(d => d.data().fcmToken as string).filter(Boolean);

  if (tokens.length === 0) return res.json({ sent: 0 });

  const result = await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
  res.json({ sent: result.successCount, failed: result.failureCount });
}
