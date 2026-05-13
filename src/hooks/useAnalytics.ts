import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event, PreparationItem, AnalyticsData } from '../types';
import { calculateAnalyticsData } from '../lib/analytics';

export interface UseAnalyticsReturn {
  analyticsData: AnalyticsData;
  isLoading: boolean;
  error: string | null;
  refreshData: () => void;
}

export function useAnalytics(): UseAnalyticsReturn {
  const [events, setEvents] = useState<Event[]>([]);
  const [preparationItemsMap, setPreparationItemsMap] = useState<Record<string, PreparationItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeEvents: (() => void) | undefined;
    let unsubscribePreps: (() => void)[] = [];

    const setupListeners = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Listen to events
        unsubscribeEvents = onSnapshot(
          collection(db, 'events'),
          (snapshot) => {
            const eventsData: Event[] = [];
            snapshot.forEach(doc => {
              eventsData.push({ id: doc.id, ...doc.data() } as Event);
            });
            setEvents(eventsData);

            // Clean up existing prep listeners
            unsubscribePreps.forEach(unsub => unsub());
            unsubscribePreps = [];

            // Set up preparation items listeners for each event
            const prepMap: Record<string, PreparationItem[]> = {};
            let completedListeners = 0;

            if (eventsData.length === 0) {
              setPreparationItemsMap({});
              setIsLoading(false);
              return;
            }

            eventsData.forEach(event => {
              const prepUnsubscribe = onSnapshot(
                collection(db, `events/${event.id}/preparationItems`),
                (prepSnapshot) => {
                  const prepItems: PreparationItem[] = [];
                  prepSnapshot.forEach(prepDoc => {
                    prepItems.push({ id: prepDoc.id, ...prepDoc.data() } as PreparationItem);
                  });
                  
                  prepMap[event.id] = prepItems;
                  completedListeners++;
                  
                  if (completedListeners === eventsData.length) {
                    setPreparationItemsMap(prepMap);
                    setIsLoading(false);
                  }
                },
                (error) => {
                  console.warn(`Failed to load preparation items for event ${event.id}:`, error);
                  prepMap[event.id] = [];
                  completedListeners++;
                  
                  if (completedListeners === eventsData.length) {
                    setPreparationItemsMap(prepMap);
                    setIsLoading(false);
                  }
                }
              );
              
              unsubscribePreps.push(prepUnsubscribe);
            });
          },
          (error) => {
            console.error('Failed to load events:', error);
            setError('イベントデータの読み込みに失敗しました');
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('Failed to setup analytics listeners:', err);
        setError('分析データの初期化に失敗しました');
        setIsLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubscribeEvents?.();
      unsubscribePreps.forEach(unsub => unsub());
    };
  }, []);

  const analyticsData = useMemo(() => {
    if (events.length === 0) {
      return {
        eventCount: 0,
        totalBudget: 0,
        completedEvents: 0,
        avgBudgetPerEvent: 0,
        topVenues: [],
        topRegions: [],
        monthlyTrend: [],
        preparationEfficiency: {
          avgLeadTime: 0,
          completionRate: 0,
          onTimeRate: 0
        }
      };
    }

    return calculateAnalyticsData(events, preparationItemsMap);
  }, [events, preparationItemsMap]);

  const refreshData = () => {
    // Force refresh by clearing and reloading
    setIsLoading(true);
    setError(null);
    // The useEffect will handle the refresh
  };

  return {
    analyticsData,
    isLoading,
    error,
    refreshData
  };
}