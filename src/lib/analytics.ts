import { Event, PreparationItem, AnalyticsData, MonthlyTrend, RegionStats } from '../types';

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(n);
}

export function formatCurrencyCompact(n: number): string {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `¥${(n / 10_000).toFixed(0)}万`;
  return formatCurrency(n);
}

function getBudget(items: PreparationItem[]): number {
  return items.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function getYearMonth(d: string): string {
  if (!d) return '';
  const [y, m] = d.split('-');
  return `${y}-${m}`;
}

export function calculateAnalyticsData(
  events: Event[],
  prepItemsByEvent: Record<string, PreparationItem[]>
): AnalyticsData {
  const total = events.length;
  const completed = events.filter(e => e.status === 'completed' || e.status === '完了').length;

  // Budget per event
  const budgets = events.map(e => getBudget(prepItemsByEvent[e.id] || []));
  const totalBudget = budgets.reduce((s, b) => s + b, 0);
  const avgBudget = total > 0 ? totalBudget / total : 0;

  // Completion rate
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  // On-time rate (events that have a status of completed)
  const onTimeRate = completionRate;

  // Average preparation days (start to now for non-completed, or start to end)
  const prepDays = events.map(e => {
    if (!e.start) return 0;
    const ref = e.end || e.start;
    return daysBetween(e.start, ref);
  });
  const avgPreparationDays = prepDays.length > 0
    ? prepDays.reduce((s, d) => s + d, 0) / prepDays.length
    : 0;

  // Active regions
  const regionSet = new Set(events.map(e => e.region).filter(Boolean));
  const activeRegions = regionSet.size;

  // Monthly trends
  const monthMap: Record<string, { count: number; budget: number }> = {};
  events.forEach((e, i) => {
    const ym = getYearMonth(e.start);
    if (!ym) return;
    if (!monthMap[ym]) monthMap[ym] = { count: 0, budget: 0 };
    monthMap[ym].count++;
    monthMap[ym].budget += budgets[i];
  });
  const monthlyTrends: MonthlyTrend[] = Object.entries(monthMap)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([month, v]) => ({ month, ...v }));

  // Busiest month
  const busiestMonth = monthlyTrends.length > 0
    ? monthlyTrends.reduce((a, b) => b.count > a.count ? b : a).month
    : '';

  // Region stats
  const regionMap: Record<string, { count: number; budget: number }> = {};
  events.forEach((e, i) => {
    const r = e.region || 'その他';
    if (!regionMap[r]) regionMap[r] = { count: 0, budget: 0 };
    regionMap[r].count++;
    regionMap[r].budget += budgets[i];
  });
  const regionStats: RegionStats[] = Object.entries(regionMap)
    .map(([region, v]) => ({ region, ...v }))
    .sort((a, b) => b.count - a.count);

  const topRegion = regionStats[0]?.region || '';

  // Top venues
  const venueMap: Record<string, { count: number; budget: number }> = {};
  events.forEach((e, i) => {
    const v = e.venue || '不明';
    if (!venueMap[v]) venueMap[v] = { count: 0, budget: 0 };
    venueMap[v].count++;
    venueMap[v].budget += budgets[i];
  });
  const topVenues = Object.entries(venueMap)
    .map(([venue, v]) => ({ venue, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Type stats
  const typeMap: Record<string, number> = {};
  events.forEach(e => {
    const t = e.type || 'その他';
    typeMap[t] = (typeMap[t] || 0) + 1;
  });
  const typeStats = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Client stats
  const clientMap: Record<string, { count: number; budget: number }> = {};
  events.forEach((e, i) => {
    const c = e.client || '不明';
    if (!clientMap[c]) clientMap[c] = { count: 0, budget: 0 };
    clientMap[c].count++;
    clientMap[c].budget += budgets[i];
  });
  const clientStats = Object.entries(clientMap)
    .map(([client, v]) => ({ client, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalEvents: total,
    completedEvents: completed,
    totalBudget,
    avgBudget,
    completionRate,
    onTimeRate,
    avgPreparationDays,
    activeRegions,
    topVenues,
    topRegion,
    busiestMonth,
    monthlyTrends,
    regionStats,
    typeStats,
    clientStats,
  };
}
