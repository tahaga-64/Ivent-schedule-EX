import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

/**
 * POST /api/send-email
 * Body: { to: string[], subject: string, html: string }
 *
 * Vercel 環境変数 RESEND_API_KEY が必要。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'RESEND_API_KEY is not configured' });
  }

  const { to, subject, html } = req.body as {
    to: string[];
    subject: string;
    html: string;
  };

  if (!to?.length || !subject || !html) {
    return res.status(400).json({ error: 'to, subject, html are required' });
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Ivent <noreply@ivent-schedule.com>',
      to,
      subject,
      html,
    });
    return res.json({ id: result.data?.id, sent: to.length });
  } catch (err) {
    console.error('[send-email] error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Email send failed' });
  }
}
