export type EventStatus = 'scheduled' | 'in_progress' | 'waiting' | 'ready' | 'completed' | 'cancelled';

/** 自由記入欄の「最終記入」（Firebase Auth を手がかりに保存） */
export interface FieldAuthorAttribution {
  updatedByUid?: string | null;
  updatedByEmail?: string | null;
  updatedByName?: string | null;
  updatedAt?: string;
}

export interface Event {
  id: string;
  start: string;
  end: string;
  region: string;
  dept: string;
  type: string;
  venue: string;
  client: string;
  note: string;
  /** 詳細画面の共有メモ（自由記入・全員可） */
  detailMemo?: string;
  detailMemoAttribution?: FieldAuthorAttribution;
  /** 担当者（スタッフリストから選択） */
  assignees?: string[];
  /** 日別メンバー役割 { "YYYY-MM-DD": { "メンバー名": "役割テキスト" } } */
  dailyRoles?: Record<string, Record<string, string>>;
  emoji?: string;
  photos?: EventPhoto[];
  status?: EventStatus;
  prepBudgetTotal?: number;
}

export interface PreparationItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  shippingFee: number;
  arrived: boolean;
  prepared: boolean;
  note: string;
  url?: string;
  order: number;
}

export interface EventPhoto {
  id: string;
  url: string;
  storagePath?: string;
  uploadedAt: string;
  caption?: string;
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: { toDate(): Date } | Date | null;
  createdAt?: { toDate(): Date } | Date | null;
}

export interface Notification {
  id: string;
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'prep_item_updated' | 'budget_alert';
  title: string;
  message: string;
  eventId?: string;
  recipientUid?: string;
  actorUid?: string;
  actorName?: string | null;
  actorEmail?: string | null;
  userId?: string;
  read: boolean;
  createdAt: { toDate(): Date; toMillis(): number } | Date | null;
  data?: Record<string, unknown>;
}
