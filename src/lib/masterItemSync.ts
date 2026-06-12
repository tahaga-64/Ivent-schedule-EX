import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { PreparationItem } from '../types';

/** 名前比較用の正規化（前後・内部の空白を無視） */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

/**
 * 準備物リストの保存時に「今回新しく名前が付いたアイテム」を備品マスター（masterItems）へ自動登録する。
 * - 前回保存時に同名がすでにあったアイテムは対象外（追加・改名されたものだけが候補）
 * - マスターに同名（空白無視で比較）が存在する場合はスキップ
 * - 単価・数量・URLは準備物の値を初期値として引き継ぐ
 */
export async function syncNewPrepItemsToMaster(
  saved: PreparationItem[],
  previous: PreparationItem[],
): Promise<void> {
  const prevNames = new Set(previous.map(i => normalizeName(i.name)).filter(Boolean));
  const candidates = saved.filter(i => {
    const n = normalizeName(i.name);
    return n !== '' && !prevNames.has(n);
  });
  if (candidates.length === 0) return;

  const snap = await getDocs(collection(db, 'masterItems'));
  const masterNames = new Set(
    snap.docs.map(d => normalizeName((d.data().name as string) ?? '')).filter(Boolean),
  );

  const seen = new Set<string>();
  for (const item of candidates) {
    const n = normalizeName(item.name);
    if (masterNames.has(n) || seen.has(n)) continue;
    seen.add(n);
    await addDoc(collection(db, 'masterItems'), {
      name: item.name.trim(),
      unitPrice: item.unitPrice || 0,
      defaultQuantity: item.quantity || 1,
      note: '',
      url: item.url?.trim() ?? '',
      updatedAt: serverTimestamp(),
    });
  }
}
