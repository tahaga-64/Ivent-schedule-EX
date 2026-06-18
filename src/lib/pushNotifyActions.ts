import type { Event, EventStatus, PreparationItem } from '../types';
import { fmtDateJPFull, normalizeRegion, statusStyle } from './eventHelpers';
import { notifyPush } from './pushNotifications';

/** 通知本文用: 会場 / 日付 / 地域 */
export function formatEventSummary(event: Pick<Event, 'venue' | 'start' | 'region'>): string {
  const parts = [event.venue, fmtDateJPFull(event.start), normalizeRegion(event.region ?? '')]
    .map(p => (p ?? '').trim())
    .filter(Boolean);
  return parts.join(' / ') || event.venue || 'イベント';
}

const PREP_ORDER_LABELS: Record<string, string> = {
  unordered: '未発注',
  ordered: '発注済',
  shipping: '配送中',
  arrived: '着荷',
  completed: '完了',
};

function prepOrderLabel(status?: string): string {
  return PREP_ORDER_LABELS[status ?? 'unordered'] ?? '未発注';
}

/** 発注状況の差分を検出（保存前後のスナップショット比較） */
export function detectPrepOrderStatusChanges(
  previous: PreparationItem[],
  current: PreparationItem[],
): Array<{ name: string; from: string; to: string }> {
  const prevById = new Map(previous.map(i => [i.id, i.orderStatus ?? 'unordered']));
  const changes: Array<{ name: string; from: string; to: string }> = [];

  for (const item of current) {
    if (!item.name?.trim()) continue;
    const prev = prevById.get(item.id) ?? 'unordered';
    const curr = item.orderStatus ?? 'unordered';
    if (prev !== curr) {
      changes.push({ name: item.name.trim(), from: prev, to: curr });
    }
  }

  return changes;
}

export function notifyPrepListSaved(
  event: Pick<Event, 'id' | 'venue'>,
  previous: PreparationItem[],
  current: PreparationItem[],
  progress: { prepItemDone: number; prepItemTotal: number },
  lastNotifyAtRef: { current: number },
): void {
  const orderChanges = detectPrepOrderStatusChanges(previous, current);

  if (orderChanges.length > 0) {
    const detail = orderChanges.length === 1
      ? `「${orderChanges[0].name}」${prepOrderLabel(orderChanges[0].from)}→${prepOrderLabel(orderChanges[0].to)}`
      : `${orderChanges.length}件の発注状況を更新（${orderChanges[0].name} 他）`;
    notifyPush({
      type: 'prep_updated',
      title: '発注状況が更新されました',
      message: `${event.venue}：${detail}`,
      eventId: event.id,
    });
    lastNotifyAtRef.current = Date.now();
    return;
  }

  const now = Date.now();
  if (now - lastNotifyAtRef.current <= 5 * 60 * 1000) return;
  lastNotifyAtRef.current = now;

  const { prepItemDone, prepItemTotal } = progress;
  notifyPush({
    type: 'prep_updated',
    title: '準備物リストが更新されました',
    message: prepItemTotal > 0 ? `${event.venue}（着荷 ${prepItemDone}/${prepItemTotal}）` : event.venue,
    eventId: event.id,
  });
}

export function notifyEventStatusChanged(event: Event, status: EventStatus): void {
  notifyPush({
    type: 'event_status_updated',
    title: 'イベントステータスが変更されました',
    message: `${formatEventSummary(event)} → ${statusStyle(status).label}`,
    eventId: event.id,
  });
}

export function notifyContainerBoxUpdated(
  event: Pick<Event, 'id' | 'venue' | 'start' | 'region'>,
  detail: { kind: 'save' | 'settle'; itemCount?: number; totalQty?: number },
): void {
  const summary = formatEventSummary(event);

  if (detail.kind === 'settle') {
    notifyPush({
      type: 'container_updated',
      title: 'コンテナボックス在庫精算',
      message: `${summary}：イベント終了の在庫精算が反映されました`,
      eventId: event.id,
    });
    return;
  }

  const qtyPart = detail.itemCount != null && detail.totalQty != null
    ? `${detail.itemCount}種類 / 合計${detail.totalQty}個`
    : '備品リストを更新';
  notifyPush({
    type: 'container_updated',
    title: 'コンテナボックスを更新しました',
    message: `${summary}：${qtyPart}`,
    eventId: event.id,
  });
}
