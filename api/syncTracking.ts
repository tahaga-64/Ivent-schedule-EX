import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getTrack17ApiKey, track17GetInfo, mapTrack17ToOrderStatus, extractMainStatus } from './lib/track17';

function getDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw);
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    return getFirestore(app);
  } catch (e) {
    console.error('firebase-admin init failed:', e);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const apiKey = getTrack17ApiKey();
  if (!apiKey) {
    return res.json({ updated: 0, message: 'TRACK17_API_KEY not configured' });
  }

  const db = getDb();
  if (!db) {
    return res.status(503).json({ error: 'Firestore is not configured' });
  }

  try {
    const snap = await db
      .collectionGroup('preparationItems')
      .where('trackingNumber', '>', '')
      .get();

    const items: Array<{
      ref: FirebaseFirestore.DocumentReference;
      trackingNumber: string;
      carrierCode?: string;
    }> = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const tn = (data.trackingNumber as string)?.trim();
      if (!tn) return;
      items.push({
        ref: docSnap.ref,
        trackingNumber: tn,
        carrierCode: data.carrierCode as string | undefined,
      });
    });

    if (items.length === 0) {
      return res.json({ updated: 0, checked: 0 });
    }

    const BATCH = 40;
    let updated = 0;

    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const numbers = batch.map(item => {
        const carrier = item.carrierCode ? parseInt(item.carrierCode, 10) : undefined;
        return {
          number: item.trackingNumber,
          ...(carrier != null && !Number.isNaN(carrier) ? { carrier } : {}),
        };
      });

      const result = await track17GetInfo(numbers);
      if (!result.ok) {
        console.warn('track17 gettrackinfo failed:', result.error);
        continue;
      }

      const accepted = (result.data as { data?: { accepted?: Array<Record<string, unknown>> } })?.data?.accepted ?? [];

      for (const trackItem of accepted) {
        const number = trackItem.number as string | undefined;
        if (!number) continue;
        const mainStatus = extractMainStatus(trackItem);
        const orderStatus = mapTrack17ToOrderStatus(mainStatus);
        if (!orderStatus) continue;

        const match = batch.find(b => b.trackingNumber === number);
        if (!match) continue;

        await match.ref.update({
          orderStatus,
          arrived: orderStatus === 'arrived',
          prepared: orderStatus === 'arrived',
          lastTrackedAt: new Date().toISOString(),
          trackingStatus: mainStatus ?? null,
        });
        updated += 1;
      }
    }

    return res.json({ updated, checked: items.length });
  } catch (e) {
    console.error('syncTracking error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
