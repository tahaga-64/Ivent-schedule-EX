import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function ensureAdmin(): void {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw === 'undefined') throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) });
}

/**
 * 担当者追加時に特定ユーザーのみへ FCM プッシュ通知を送る。
 * Body: { assigneeEmails: string[], eventId: string, eventVenue: string, actorName: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    ensureAdmin();
  } catch (initErr) {
    console.error('[notify-assignees] Firebase Admin init failed:', initErr);
    return res.status(503).json({ error: 'Push server is not configured.' });
  }

  const { assigneeEmails, eventId, eventVenue, actorName } = req.body as {
    assigneeEmails: string[];
    eventId: string;
    eventVenue: string;
    actorName: string;
  };

  if (!Array.isArray(assigneeEmails) || assigneeEmails.length === 0) {
    return res.status(400).json({ error: 'assigneeEmails is required' });
  }

  const db = getFirestore();
  const usersSnap = await db.collection('users').get();

  const tokens = usersSnap.docs
    .filter(d => {
      const email = d.data().email as string | undefined;
      return email && assigneeEmails.includes(email) && d.data().fcmToken;
    })
    .map(d => d.data().fcmToken as string);

  if (tokens.length === 0) return res.json({ sent: 0, message: 'No FCM tokens for target users' });

  const title = '担当者に追加されました';
  const body = `${actorName}さんが「${eventVenue}」の担当者にあなたを追加しました`;
  const link = eventId ? `/?event=${eventId}` : '/';

  const CHUNK = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const result = await getMessaging().sendEachForMulticast({
      tokens: tokens.slice(i, i + CHUNK),
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: '/icon.png',
          badge: '/icon.png',
        },
        fcmOptions: { link },
      },
    });
    successCount += result.successCount;
    failureCount += result.failureCount;
  }

  res.json({ sent: successCount, failed: failureCount });
}
