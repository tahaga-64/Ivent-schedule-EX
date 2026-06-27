/** 発注・郵送ページのロジック（届け先ごとの集約・色） */
import type { PreparationItem } from '../types';
import { normalizeOrderStatus } from './orderStatus';
import { ARRIVAL_DEST_STYLE, ARRIVAL_DESTINATIONS } from '../constants';

/** イベントをまたいで集約した発注・郵送アイテム */
export interface ShippingItem extends PreparationItem {
  eventId: string;
  eventVenue: string;
  eventStart: string;
}

/** 届け先が設定されている準備物か（発注・郵送ページの対象） */
export function hasDestination(item: Pick<PreparationItem, 'name' | 'arrivalDestination'>): boolean {
  return !!item.name?.trim() && !!item.arrivalDestination?.trim();
}

/** まだ完了（着荷）していない未処理アイテムか */
export function isPendingShippingItem(
  item: Pick<PreparationItem, 'name' | 'arrivalDestination' | 'orderStatus'>,
): boolean {
  return hasDestination(item) && normalizeOrderStatus(item.orderStatus) !== 'completed';
}

/** プリセット先(新宿→長南)を先頭、その後カスタム先を名前順、未指定を末尾に並べる */
function destOrder(dest: string): number {
  const idx = (ARRIVAL_DESTINATIONS as readonly string[]).indexOf(dest);
  if (idx >= 0) return idx;
  if (dest === '未指定') return 999;
  return 100;
}

/** 届け先ごとにグルーピング（並び順つき） */
export function groupByDestination<T extends { arrivalDestination?: string }>(
  items: T[],
): { destination: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const dest = (it.arrivalDestination || '').trim() || '未指定';
    if (!map.has(dest)) map.set(dest, []);
    map.get(dest)!.push(it);
  }
  return [...map.entries()]
    .map(([destination, list]) => ({ destination, items: list }))
    .sort((a, b) => destOrder(a.destination) - destOrder(b.destination)
      || a.destination.localeCompare(b.destination, 'ja'));
}

const FALLBACK_DEST_COLORS = ['#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6'];

/** 届け先の色ドット。プリセットは固定色、カスタムは名前ハッシュで安定的に割当 */
export function destDotColor(dest: string): string {
  if (ARRIVAL_DEST_STYLE[dest]) return ARRIVAL_DEST_STYLE[dest].dot;
  let h = 0;
  for (let i = 0; i < dest.length; i++) h = (h * 31 + dest.charCodeAt(i)) >>> 0;
  return FALLBACK_DEST_COLORS[h % FALLBACK_DEST_COLORS.length];
}
