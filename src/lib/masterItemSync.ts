import { collection, getDocs, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { PreparationItem } from '../types';

/** 名前比較用の正規化（前後・内部の空白を無視） */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

/**
 * 備品マスター（masterItems）をアプリの在庫DBとして扱う同期処理。
 * 準備物リストの保存時に「orderStatus が 'arrived'（着荷）に遷移したアイテム」を対象に：
 *   - マスターに同名（空白無視で比較）が既にある場合 → その個数（defaultQuantity）を追加分だけ加算
 *   - マスターに無い新規アイテムの場合 → 新しくマスターへ登録
 *
 * 対象は「前回保存時に 'arrived' ではなかった（または存在しなかった）が、
 * 今回の保存後に 'arrived' になったアイテム」のみ。
 * 既に 'arrived' だったアイテムの数量編集では二重加算しない。
 */
export async function syncNewPrepItemsToMaster(
  saved: PreparationItem[],
  previous: PreparationItem[],
): Promise<void> {
  // 前回スナップショットの orderStatus を id で引けるマップ
  const prevStatusById = new Map<string, string | undefined>();
  for (const item of previous) {
    prevStatusById.set(item.id, item.orderStatus);
  }

  // 'arrived'（着荷）への遷移アイテムを抽出
  // - 新規アイテム（previous に id が無い）かつ orderStatus === 'arrived'
  // - 既存アイテムで前回が 'arrived' 以外 かつ 今回が 'arrived'
  const candidates = saved.filter(i => {
    const n = normalizeName(i.name);
    if (n === '') return false;
    if (i.orderStatus !== 'arrived') return false;
    const prevStatus = prevStatusById.get(i.id);
    // 前回スナップショットに存在しなかった（新規）場合は prevStatus === undefined
    return prevStatus !== 'arrived';
  });

  if (candidates.length === 0) return;

  const snap = await getDocs(collection(db, 'masterItems'));
  // 正規化名 → 既存マスタードキュメントID
  const masterIdByName = new Map<string, string>();
  for (const d of snap.docs) {
    const n = normalizeName((d.data().name as string) ?? '');
    if (n && !masterIdByName.has(n)) masterIdByName.set(n, d.id);
  }

  // 同じ保存内に同名アイテムが複数あっても合算して扱う
  const addQtyByName = new Map<string, number>();
  const firstItemByName = new Map<string, PreparationItem>();
  for (const item of candidates) {
    const n = normalizeName(item.name);
    addQtyByName.set(n, (addQtyByName.get(n) ?? 0) + (item.quantity || 1));
    if (!firstItemByName.has(n)) firstItemByName.set(n, item);
  }

  for (const [n, qty] of addQtyByName) {
    const existingId = masterIdByName.get(n);
    if (existingId) {
      // 既存アイテム → 在庫個数を加算
      await updateDoc(doc(db, 'masterItems', existingId), {
        defaultQuantity: increment(qty),
        updatedAt: serverTimestamp(),
      });
    } else {
      // 新規アイテム → マスターへ登録
      const item = firstItemByName.get(n)!;
      await addDoc(collection(db, 'masterItems'), {
        name: item.name.trim(),
        unitPrice: item.unitPrice || 0,
        defaultQuantity: qty,
        note: '',
        url: item.url?.trim() ?? '',
        updatedAt: serverTimestamp(),
      });
    }
  }
}
