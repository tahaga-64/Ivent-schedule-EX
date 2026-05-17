import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event, PreparationItem, AnalyticsData } from '../types';
import { calculateAnalyticsData } from '../lib/analytics';

export function useAnalytics(staticEvents: Event[]) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Stable key — only changes when the set of event IDs changes
  const eventIds = useMemo(
    () => staticEvents.map(e => e.id).sort().join(','),
    [staticEvents]
  );

  useEffect(() => {
    if (staticEvents.length === 0) {
      setData(calculateAnalyticsData([], {}));
      setLoading(false);
      return;
    }

    const prepByEvent: Record<string, PreparationItem[]> = {};
    // Use a Set so repeated snapshot callbacks don't inflate the count
    const resolvedIds = new Set<string>();
    const total = staticEvents.length;
    const unsubs: (() => void)[] = [];

    const recalculate = () => {
      setData(calculateAnalyticsData(staticEvents, prepByEvent));
      if (resolvedIds.size >= total) setLoading(false);
    };

    staticEvents.forEach(event => {
      const unsub = onSnapshot(
        collection(db, 'events', event.id, 'preparationItems'),
        snap => {
          prepByEvent[event.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as PreparationItem));
          resolvedIds.add(event.id);
          recalculate();
        },
        (err) => {
          console.error(`prepItems load error for event ${event.id}:`, err);
          resolvedIds.add(event.id);
          recalculate();
        }
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [eventIds]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
}
