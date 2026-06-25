import type { Event, PreparationItem } from '../types';

/**
 * 準備物が「完了（着荷/完了）」状態か。取り消し線・カード色・preparedCount の表示判定に使用。
 * 新3段階モデルの 'completed' も完了として扱うため isPrepItemCompleted に委譲する。
 */
export function effectiveArrived(item: PreparationItem): boolean {
  return isPrepItemCompleted(item);
}

export function isPrepItemCompleted(item: PreparationItem): boolean {
  const s = item.orderStatus;
  if (s !== undefined) return s === 'arrived' || s === 'completed';
  return item.arrived;
}

export function isEmptyPrepItem(item: PreparationItem): boolean {
  return (
    !item.name?.trim() &&
    !item.note?.trim() &&
    !item.url?.trim() &&
    (item.quantity ?? 1) === 1 &&
    !item.unitPrice &&
    !item.amount &&
    !item.shippingFee &&
    !item.arrived &&
    !item.prepared &&
    !item.orderStatus
  );
}

/** 準備物リストからイベントドキュメント用の進捗フィールドを算出 */
export function computePrepProgressFields(items: PreparationItem[]): {
  prepItemTotal: number;
  prepItemDone: number;
} {
  const filled = items.filter(i => !isEmptyPrepItem(i));
  return {
    prepItemTotal: filled.length,
    prepItemDone: filled.filter(i => isPrepItemCompleted(i)).length,
  };
}

export function prepProgressFromEvent(ev: Event): { total: number; done: number } | undefined {
  if (!ev.prepItemTotal) return undefined;
  return { total: ev.prepItemTotal, done: ev.prepItemDone ?? 0 };
}

export function buildPrepProgressMap(events: Event[]): Record<string, { total: number; done: number }> {
  const map: Record<string, { total: number; done: number }> = {};
  for (const ev of events) {
    const prog = prepProgressFromEvent(ev);
    if (prog) map[ev.id] = prog;
  }
  return map;
}
