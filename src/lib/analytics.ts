import { Event, PreparationItem, AnalyticsData } from '../types';

export function calculateAnalyticsData(
  events: Event[],
  preparationItemsMap: Record<string, PreparationItem[]>
): AnalyticsData {
  const currentYear = new Date().getFullYear();
  const currentYearEvents = events.filter(event => 
    new Date(event.start).getFullYear() === currentYear
  );

  // Basic metrics
  const eventCount = currentYearEvents.length;
  const completedEvents = currentYearEvents.filter(event => 
    event.status === 'completed'
  ).length;

  // Budget calculations
  let totalBudget = 0;
  const venueStats = new Map<string, { count: number; budget: number }>();
  const regionStats = new Map<string, { count: number; budget: number }>();

  currentYearEvents.forEach(event => {
    const prepItems = preparationItemsMap[event.id] || [];
    const eventBudget = prepItems.reduce((sum, item) => 
      sum + item.amount + item.shippingFee, 0
    );
    
    totalBudget += eventBudget;

    // Venue stats
    const venueData = venueStats.get(event.venue) || { count: 0, budget: 0 };
    venueData.count++;
    venueData.budget += eventBudget;
    venueStats.set(event.venue, venueData);

    // Region stats  
    const regionData = regionStats.get(event.region) || { count: 0, budget: 0 };
    regionData.count++;
    regionData.budget += eventBudget;
    regionStats.set(event.region, regionData);
  });

  const avgBudgetPerEvent = eventCount > 0 ? totalBudget / eventCount : 0;

  // Top venues and regions
  const topVenues = Array.from(venueStats.entries())
    .map(([venue, data]) => ({ venue, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topRegions = Array.from(regionStats.entries())
    .map(([region, data]) => ({ region, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Monthly trend
  const monthlyData = new Map<string, { events: number; budget: number }>();
  
  currentYearEvents.forEach(event => {
    const monthKey = event.start.substring(0, 7); // YYYY-MM format
    const prepItems = preparationItemsMap[event.id] || [];
    const eventBudget = prepItems.reduce((sum, item) => 
      sum + item.amount + item.shippingFee, 0
    );

    const monthData = monthlyData.get(monthKey) || { events: 0, budget: 0 };
    monthData.events++;
    monthData.budget += eventBudget;
    monthlyData.set(monthKey, monthData);
  });

  const monthlyTrend = Array.from(monthlyData.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Preparation efficiency
  const preparationEfficiency = calculatePreparationEfficiency(
    currentYearEvents,
    preparationItemsMap
  );

  return {
    eventCount,
    totalBudget,
    completedEvents,
    avgBudgetPerEvent,
    topVenues,
    topRegions,
    monthlyTrend,
    preparationEfficiency
  };
}

function calculatePreparationEfficiency(
  events: Event[],
  preparationItemsMap: Record<string, PreparationItem[]>
): AnalyticsData['preparationEfficiency'] {
  let totalLeadTime = 0;
  let completedPreparations = 0;
  let onTimePreparations = 0;
  let totalPreparations = 0;

  events.forEach(event => {
    const prepItems = preparationItemsMap[event.id] || [];
    const eventStart = new Date(event.start);
    
    prepItems.forEach(item => {
      totalPreparations++;
      
      if (item.prepared) {
        completedPreparations++;
        
        // Calculate lead time (simplified - in real app, you'd track preparation dates)
        const assumedPrepDate = new Date(eventStart);
        assumedPrepDate.setDate(assumedPrepDate.getDate() - 7); // Assume 7 days before event
        const leadTime = Math.max(0, (eventStart.getTime() - assumedPrepDate.getTime()) / (1000 * 60 * 60 * 24));
        totalLeadTime += leadTime;
        
        // Consider on-time if prepared (simplified logic)
        if (item.arrived && item.prepared) {
          onTimePreparations++;
        }
      }
    });
  });

  return {
    avgLeadTime: completedPreparations > 0 ? totalLeadTime / completedPreparations : 0,
    completionRate: totalPreparations > 0 ? (completedPreparations / totalPreparations) * 100 : 0,
    onTimeRate: completedPreparations > 0 ? (onTimePreparations / completedPreparations) * 100 : 0
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(Math.round(value));
}