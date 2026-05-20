// メインの型定義を再エクスポート
export type { Event, PreparationItem, EventPhoto, Notification } from '../types';

// 後方互換性のための型エイリアス
export type Region = '東北' | '関東' | '中部' | '近畿' | '中国' | '四国' | '九州';
export type EventType = '職業体験' | '水族館' | '忍者' | 'DJI' | '超メタフェス' | 'ワークショップ' | 'その他';
export type EventStatus = '準備中' | '入荷待ち' | '完了';

/**
 * @deprecated CalendarEventは非推奨です。代わりにEventを使用してください。
 */
export interface CalendarEvent {
  id: string;
  venue: string;
  client: string;
  region: Region;
  type: EventType;
  status: EventStatus;
  start: string;
  end: string;
  emoji: string;
  color: string;
  dept?: string;
  note?: string;
}

export interface NewEventDraft {
  venue: string;
  client: string;
  type: string;
  region: Region;
  start: string;
  end: string;
}
