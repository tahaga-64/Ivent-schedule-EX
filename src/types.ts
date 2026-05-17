export type EventStatus = 'scheduled' | 'completed' | 'cancelled';

export interface CarrierInflow {
  docomo?: number;
  au?: number;
  softbank?: number;
  rakuten?: number;
  other?: number;
}

export interface AnalysisReport {
  createdAt: string;
  title?: string;
  summary?: string;
  goodPoints?: string;
  improvements?: string;
  nextActions?: string;
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
  emoji?: string;
  photos?: EventPhoto[];
  status?: EventStatus;
  sales?: number;
  grossProfit?: number;
  attendance?: number;
  seatedCount?: number;
  contracts?: number;
  carrierInflow?: CarrierInflow;
  analysisReport?: AnalysisReport;
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
  storagePath: string;
  uploadedAt: string;
  caption?: string;
  thumbnailUrl?: string;
}

export interface Notification {
  id: string;
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'prep_item_updated' | 'budget_alert';
  title: string;
  message: string;
  eventId?: string;
  userId?: string;
  read: boolean;
  createdAt: { toDate(): Date; toMillis(): number } | Date | null;
  data?: Record<string, unknown>;
}

export interface MonthlyTrend {
  month: string;
  count: number;
  budget: number;
  sales: number;
  attendance: number;
  contracts: number;
}

export interface RegionStats {
  region: string;
  count: number;
  budget: number;
}

export interface AnalyticsData {
  totalEvents: number;
  completedEvents: number;
  totalBudget: number;
  avgBudget: number;
  completionRate: number;
  onTimeRate: number;
  avgPreparationDays: number;
  activeRegions: number;
  topVenues: { venue: string; count: number; budget: number }[];
  topRegion: string;
  busiestMonth: string;
  monthlyTrends: MonthlyTrend[];
  regionStats: RegionStats[];
  typeStats: { type: string; count: number }[];
  clientStats: { client: string; count: number; budget: number }[];
  totalSales: number;
  totalGrossProfit: number;
  totalAttendance: number;
  totalSeatedCount: number;
  totalContracts: number;
  avgCarrierSwitchRate: number;
  carrierInflowTotal: CarrierInflow;
  recentAnalysisReports: { eventId: string; venue: string; start: string; analysisReport: AnalysisReport }[];
}
