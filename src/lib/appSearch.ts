import { Event } from '../types';
import { normalizeRegion, fmtDateJP } from './eventHelpers';

export type AppViewMode = 'calendar' | 'prep' | 'archive' | 'home' | 'master' | 'fish' | 'layout' | 'album' | 'schedule' | 'container';

export const SEARCH_FEATURES: { id: AppViewMode; label: string; keywords: string[] }[] = [
  { id: 'home', label: 'ホーム', keywords: ['ホーム', 'home', 'トップ', '直近', 'ダッシュボード'] },
  { id: 'calendar', label: 'カレンダー', keywords: ['カレンダー', 'calendar', '日程', '月', '予定表'] },
  { id: 'prep', label: '準備物リスト', keywords: ['準備', '準備物', 'prep', '持ち物', 'チェックリスト'] },
  { id: 'schedule', label: 'スケジュール', keywords: ['スケジュール', 'シフト', 'schedule', '勤務', '予定'] },
  { id: 'fish', label: '魚リスト', keywords: ['魚', 'さかな', 'fish', '水族館', '生体'] },
  { id: 'master', label: '備品マスター', keywords: ['備品', 'マスター', 'master', '在庫', '機材'] },
  { id: 'layout', label: 'レイアウト', keywords: ['レイアウト', 'layout', '配置', '会場図', '図面'] },
  { id: 'album', label: 'Drive', keywords: ['drive', 'アルバム', '写真', 'album', 'photo', '画像', 'google'] },
  { id: 'container', label: 'コンテナボックス', keywords: ['コンテナ', 'ボックス', 'container', '備品計算', '積載', '持ち物'] },
  { id: 'archive', label: 'アーカイブ', keywords: ['アーカイブ', 'archive', '過去', '終了'] },
];

function eventHaystack(ev: Event): string {
  return [
    ev.venue,
    ev.client,
    ev.note,
    ev.detailMemo,
    ev.type,
    normalizeRegion(ev.region),
    ev.dept,
    ev.nearestStation,
    ev.start,
    ev.end,
    ...(ev.assignees ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** スペース区切りの各語がすべてマッチするか（イベント絞り込み用） */
export function eventMatchesQuery(ev: Event, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = eventHaystack(ev);
  return tokens.every(t => hay.includes(t));
}

export function matchFeatures(query: string, limit = 5): { id: AppViewMode; label: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_FEATURES.filter(f =>
    f.label.toLowerCase().includes(q) ||
    f.keywords.some(k => {
      const kl = k.toLowerCase();
      return kl.includes(q) || q.includes(kl);
    }),
  )
    .slice(0, limit)
    .map(({ id, label }) => ({ id, label }));
}

function scoreEvent(ev: Event, query: string): number {
  const q = query.trim().toLowerCase();
  const venue = ev.venue.toLowerCase();
  const client = (ev.client || '').toLowerCase();
  if (venue === q || client === q) return 100;
  if (venue.startsWith(q)) return 80;
  if (client.startsWith(q)) return 70;
  if (venue.includes(q)) return 50;
  if (client.includes(q)) return 40;
  return 10;
}

export function searchEvents(events: Event[], query: string, limit = 8): Event[] {
  const q = query.trim();
  if (!q) return [];
  return events
    .filter(ev => !ev.id.startsWith('__cal_preview_'))
    .filter(ev => eventMatchesQuery(ev, q))
    .sort((a, b) => scoreEvent(b, q) - scoreEvent(a, q) || (a.start || '').localeCompare(b.start || ''))
    .slice(0, limit);
}

export function formatEventSearchSubtitle(ev: Event): string {
  const d = fmtDateJP(ev.start);
  const parts = [`${d.month}/${d.day}`, normalizeRegion(ev.region) || null, ev.type || null, ev.client || null].filter(Boolean);
  return parts.join(' · ');
}
