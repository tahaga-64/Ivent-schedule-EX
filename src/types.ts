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
  status?: string;
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
  createdAt: any;
  data?: Record<string, any>;
}

export interface MonthlyTrend {
  month: string;
  count: number;
  budget: number;
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
}
