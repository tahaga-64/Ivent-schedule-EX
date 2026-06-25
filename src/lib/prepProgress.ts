import type { Event, PreparationItem } from '../types';

export function effectiveArrived(item: PreparationItem): boolean {
  if (item.orderStatus !== undefined) return item.orderStatus === 'arrived';
  return item.arrived;
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
