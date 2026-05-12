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
  coverImage?: string;
  status?: 'planning' | 'preparing' | 'in-progress' | 'completed' | 'cancelled';
}

export interface EventPhoto {
  id: string;
  url: string;
  storagePath: string;
  uploadedAt: string;
  caption?: string;
  thumbnailUrl?: string;
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
  order: number;
}

export interface Notification {
  id: string;
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'prep_item_updated' | 'budget_alert';
  title: string;
  message: string;
  eventId?: string;
  userId?: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

export interface BulkOperation {
  type: 'update' | 'delete' | 'export';
  eventIds: string[];
  updates?: Partial<Event>;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface AnalyticsData {
  eventCount: number;
  totalBudget: number;
  completedEvents: number;
  avgBudgetPerEvent: number;
  topVenues: Array<{ venue: string; count: number; budget: number }>;
  topRegions: Array<{ region: string; count: number; budget: number }>;
  monthlyTrend: Array<{ month: string; events: number; budget: number }>;
  preparationEfficiency: {
    avgLeadTime: number;
    completionRate: number;
    onTimeRate: number;
  };
}
