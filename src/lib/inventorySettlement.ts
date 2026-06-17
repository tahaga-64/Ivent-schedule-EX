import {
  collection, doc, writeBatch, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { InventorySettlement } from '../types';

/**
 * イベント終了時の在庫精算をマスターへ反映する。
 * 持ち出し時にマスターから減算済みの分について、未消費分（taken - consumed）を返却する。
 */
export async function applyInventorySettlement(
  eventId: string,
  settlements: InventorySettlement[],
  previousReturned: Record<string, number>,
): Promise<void> {
  const batch = writeBatch(db);
  const settlementPath = `events/${eventId}/inventorySettlements`;

  for (const s of settlements) {
    const consumed = Math.max(0, Math.min(s.consumedQuantity, s.takenQuantity));
    const targetReturn = s.takenQuantity - consumed;
    const prevReturn = previousReturned[s.masterItemId] ?? 0;
    const deltaReturn = targetReturn - prevReturn;

    batch.set(doc(db, settlementPath, s.masterItemId), {
      masterItemId: s.masterItemId,
      name: s.name,
      takenQuantity: s.takenQuantity,
      consumedQuantity: consumed,
      returnedQuantity: targetReturn,
      settled: true,
      updatedAt: serverTimestamp(),
    });

    if (deltaReturn !== 0) {
      batch.update(doc(db, 'masterItems', s.masterItemId), {
        defaultQuantity: increment(deltaReturn),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
