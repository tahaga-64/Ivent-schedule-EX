import type { Event } from '../types';

/** 常駐の提案用リスト（準備物リスト専用・スケジュール非表示） */
export const PROPOSAL_EVENT_ID = '__proposal__';

export const PROPOSAL_DEFAULT_VENUE = '提案用';

/** 削除対象のイベントID（シードから除去済み・Firestoreに残っている場合） */
export const OBSOLETE_EVENT_IDS = ['20'] as const;

export function isProposalEvent(ev: Pick<Event, 'id'> | null | undefined): boolean {
  return ev?.id === PROPOSAL_EVENT_ID;
}

export function isObsoleteEvent(ev: Pick<Event, 'id' | 'venue'>): boolean {
  if ((OBSOLETE_EVENT_IDS as readonly string[]).includes(ev.id)) return true;
  return /エディオンくずはモール/.test(ev.venue ?? '');
}

/** カレンダー・カンバン・ホーム等のスケジュール系から除外 */
export function isScheduleEvent(ev: Event): boolean {
  return !isProposalEvent(ev) && !isObsoleteEvent(ev);
}

export function createDefaultProposalEvent(): Event {
  return {
    id: PROPOSAL_EVENT_ID,
    venue: PROPOSAL_DEFAULT_VENUE,
    start: '2099-01-01',
    end: '2099-12-31',
    region: '',
    dept: '',
    type: '提案用',
    client: '',
    note: '',
    status: 'scheduled',
    isSystemEvent: true,
  };
}
