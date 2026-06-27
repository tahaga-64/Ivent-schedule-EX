import type { PreparationItem } from '../types';
import { normalizeOrderStatus } from './orderStatus';

/**
 * 「未着一覧（新宿）」の対象判定。
 * 新宿着で、到着予定日が当日以前（＝予定日を過ぎた/当日）かつ、まだ着荷（完了）していない準備物を全て対象とする。
 * 旧仕様は発注済みのみだったが、未発注のまま予定日を過ぎたものも「未着」として全て表示する。
 */
export function isUnarrivedShinjukuItem(
  item: Pick<PreparationItem, 'name' | 'arrivalDestination' | 'orderStatus' | 'arrivalDate'>,
  today: string,
): boolean {
  return (
    !!item.name?.trim() &&
    item.arrivalDestination === '新宿' &&
    normalizeOrderStatus(item.orderStatus) !== 'completed' &&
    !!item.arrivalDate &&
    item.arrivalDate <= today
  );
}
