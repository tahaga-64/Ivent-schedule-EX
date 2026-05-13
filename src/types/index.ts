// メインの型定義を再エクスポート
export type {
  Event,
  PreparationItem,
  EventPhoto,
  Notification,
  AnalyticsData,
  MonthlyTrend,
  RegionStats,
  CarrierInflow,
  EventRetrospective,
  EventAnalysisReport
} from '../types';

// 後方互換性のための型エイリアス
export type Region = '東日本' | '西日本' | '南日本' | '中日本';
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
  type: EventType;
  region: Region;
  start: string;
  end: string;
  sales?: number;
  grossProfit?: number;
  attendance?: number;
  seatedCount?: number;
  contracts?: number;
  carrierInflow?: {
    docomo?: number;
    au?: number;
    softbank?: number;
    rakuten?: number;
    other?: number;
  };
  retrospective?: {
    goodPoints?: string;
    improvements?: string;
  };
  analysisReport?: {
    createdAt?: string;
    title?: string;
    summary?: string;
    goodPoints?: string;
    improvements?: string;
    nextActions?: string;
  };
}
