import type { Event } from '../types';

export interface NextEventSummary {
  /** 最も近い開催日のイベント数（同日複数対応） */
  count: number;
  /** 今日からの日数（今日=0、予定なし=null） */
  daysToNext: number | null;
  /** 「今日」/「N日後」表示用ラベル（予定なし=''） */
  dayLabel: string;
  /** 先頭イベントの会場（なければ type、それもなければ null） */
  primaryVenue: string | null;
  /** 最も近い開催日の全イベントの会場名リスト */
  venues: string[];
}

/** ホーム「次イベント」カード用：直近開催日のイベント概要を算出 */
export function summarizeNextEvents(events: Event[], today: string): NextEventSummary {
  const upcoming = events
    .filter(e => e.status !== 'cancelled' && !!e.start && e.start >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (upcoming.length === 0) {
    return { count: 0, daysToNext: null, dayLabel: '', primaryVenue: null, venues: [] };
  }

  const nearestDate = upcoming[0].start;
  const sameDay = upcoming.filter(e => e.start === nearestDate);
  const daysToNext = Math.round(
    (new Date(nearestDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000,
  );
  const venues = sameDay.map(e => e.venue?.trim() || e.type?.trim() || 'イベント');

  return {
    count: sameDay.length,
    daysToNext,
    dayLabel: daysToNext === 0 ? '今日' : `${daysToNext}日後`,
    primaryVenue: venues[0] ?? null,
    venues,
  };
}
