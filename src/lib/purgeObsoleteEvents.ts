import { deleteDoc, doc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { OBSOLETE_EVENT_IDS, isObsoleteEvent } from './systemEvents';

/**
 * 廃止イベントを Firestore から削除する（編集者のみ・ベストエフォート）。
 * サブコレクション（preparationItems, fishItems 等）も合わせて削除。
 */
export async function purgeObsoleteEvents(): Promise<void> {
  const idsToDelete = new Set<string>(OBSOLETE_EVENT_IDS);

  const eventsSnap = await getDocs(collection(db, 'events'));
  for (const d of eventsSnap.docs) {
    const data = d.data();
    if (isObsoleteEvent({ id: d.id, venue: (data.venue as string) ?? '' })) {
      idsToDelete.add(d.id);
    }
  }

  for (const eventId of idsToDelete) {
    const subcols = ['preparationItems', 'containerItems', 'inventorySettlements', 'fishItems'];
    for (const sub of subcols) {
      const snap = await getDocs(collection(db, `events/${eventId}/${sub}`));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
    }
    try {
      await deleteDoc(doc(db, 'events', eventId));
    } catch {
      // 権限不足等は無視
    }
  }
}
