import type { OrderStatus } from '../types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  unordered: '未発注',
  ordered: '発注済み',
  shipping: '発注済み',
  arrived: '完了',
  completed: '完了',
};

/** Legacy 'shipping' → 'ordered', 'arrived' → 'completed'; unknown → 'unordered' */
export function normalizeOrderStatus(status: string | undefined): OrderStatus {
  if (status === 'shipping') return 'ordered';
  if (status === 'arrived') return 'completed';
  if (status === 'unordered' || status === 'ordered' || status === 'completed') return status;
  return 'unordered';
}
