export type EventStatus = 'scheduled' | 'in_progress' | 'waiting' | 'ready' | 'completed' | 'cancelled';

/** 自由記入欄の「最終記入」（Firebase Auth を手がかりに保存） */
export interface FieldAuthorAttribution {
  updatedByUid?: string | null;
  updatedByEmail?: string | null;
  updatedByName?: string | null;
  updatedAt?: string;
}

export interface EventFinancials {
  estimatedRevenue?: number;
  actualRevenue?: number;
  estimatedStaffCost?: number;
  actualStaffCost?: number;
  estimatedOutsourceCost?: number;
  actualOutsourceCost?: number;
  estimatedVenueCost?: number;
  actualVenueCost?: number;
  estimatedTransportCost?: number;
  actualTransportCost?: number;
  estimatedPrepCost?: number;
  actualPrepCost?: number;
  estimatedOtherCost?: number;
  actualOtherCost?: number;
  memo?: string;
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
  photos?: EventPhoto[];
  status?: EventStatus;
  prepBudgetTotal?: number;
  prepBudget?: number;
  nearestStation?: string;
  financials?: EventFinancials;
  /** 準備物の件数（空行を除く）。collectionGroup 購読の代替 */
  prepItemTotal?: number;
  /** 到着＋準備完了の件数 */
  prepItemDone?: number;
}

export type OrderStatus = 'unordered' | 'ordered' | 'shipping' | 'arrived';

export interface PreparationItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  shippingFee: number;
  arrived: boolean;
  prepared: boolean;
  arrivalDate?: string;
  /** 到着先（新宿 / 長南） */
  arrivalDestination?: '新宿' | '長南' | '';
  note: string;
  noteUpdatedByName?: string | null;
  noteUpdatedByEmail?: string | null;
  noteUpdatedAt?: string;
  orderStatus?: OrderStatus;
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
  driveFileId?: string;
  driveViewUrl?: string;
}

export interface FishItem {
  id: string;
  name: string;
  count: number;
  note?: string;
  order: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: { toDate(): Date } | Date | null;
  createdAt?: { toDate(): Date } | Date | null;
}
