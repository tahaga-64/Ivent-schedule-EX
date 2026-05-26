import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { Resend } from 'resend';

function ensureAdmin(): void {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw === 'undefined') throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required' });
  }

  try {
    ensureAdmin();
  } catch (e) {
    return res.status(503).json({ error: 'Server not configured', detail: String(e) });
  }

  try {
    await getAuth().verifyIdToken(authHeader.slice(7));
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }

  const { eventVenue, eventStart, eventEnd, senderName } = req.body as {
    eventVenue: string;
    eventStart: string;
    eventEnd: string;
    senderName: string;
  };
  if (!eventVenue) return res.status(400).json({ error: 'eventVenue is required' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'RESEND_API_KEY is not configured' });

  const db = getFirestore();
  const snap = await db.collection('users').get();
  const emails = [...new Set(
    snap.docs.map(d => d.data().email as string | undefined).filter((e): e is string => Boolean(e))
  )];
  if (emails.length === 0) return res.json({ sent: 0, message: 'No email addresses registered' });

  const dateLabel = eventStart === eventEnd ? eventStart : `${eventStart} 〜 ${eventEnd}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px;">
      <h2 style="font-size:16px;color:#1e293b;margin-bottom:8px;">📅 イベント情報のお知らせ</h2>
      <p style="font-size:14px;color:#475569;margin-bottom:20px;">
        ${senderName} さんからイベントの最新情報をお送りします。
      </p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">会場</div>
        <div style="font-size:18px;font-weight:bold;color:#1e293b;margin-bottom:14px;">${eventVenue}</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">日程</div>
        <div style="font-size:14px;color:#1e293b;">${dateLabel}</div>
      </div>
      <a href="https://ivent-schedule-ex.vercel.app"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">
        アプリで確認する
      </a>
      <p style="font-size:11px;color:#94a3b8;margin-top:20px;">
        このメールは Ivent Manager から自動送信されました。
      </p>
    </div>`;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'Ivent <noreply@ivent-schedule.com>',
    to: emails,
    subject: `[Ivent] ${eventVenue} (${dateLabel})`,
    html,
  });

  return res.json({ sent: emails.length });
}
