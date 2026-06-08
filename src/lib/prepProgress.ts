import type { Event, PreparationItem } from '../types';

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
    !item.prepared
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
    prepItemDone: filled.filter(i => i.arrived && i.prepared).length,
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
