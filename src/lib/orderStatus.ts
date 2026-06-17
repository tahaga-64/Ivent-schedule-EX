import type { OrderStatus } from '../types';

/** 旧ステータス（shipping / arrived）を新3段階へ正規化 */
export function normalizeOrderStatus(status: string | undefined): OrderStatus {
  if (status === 'ordered' || status === 'completed') return status;
  if (status === 'shipping') return 'ordered';
  if (status === 'arrived') return 'completed';
  return 'unordered';
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  unordered: '未発注',
  ordered: '発注済み',
  completed: '完了',
};
