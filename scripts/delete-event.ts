/**
 * Firestore から指定イベントを削除するワンショットスクリプト。
 * 使用例: npx tsx scripts/delete-event.ts 20
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const eventId = process.argv[2];
if (!eventId) {
  console.error('Usage: npx tsx scripts/delete-event.ts <eventId>');
  process.exit(1);
}

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!saJson) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON is required');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(saJson)) });
}

const db = getFirestore();

async function deleteSubcollection(path: string) {
  const snap = await db.collection(path).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

async function main() {
  const eventRef = db.doc(`events/${eventId}`);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    console.log(`Event ${eventId} not found — nothing to delete`);
    return;
  }
  console.log(`Deleting event: ${eventSnap.data()?.venue ?? eventId}`);

  for (const sub of ['preparationItems', 'containerItems', 'inventorySettlements', 'fishItems']) {
    await deleteSubcollection(`events/${eventId}/${sub}`);
  }

  await eventRef.delete();
  console.log(`Deleted events/${eventId}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
