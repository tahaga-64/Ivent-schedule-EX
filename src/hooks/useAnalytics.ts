import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event, PreparationItem, AnalyticsData } from '../types';
import { calculateAnalyticsData } from '../lib/analytics';

export function useAnalytics(staticEvents: Event[]) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (staticEvents.length === 0) {
      setData(calculateAnalyticsData([], {}));
      setLoading(false);
      return;
    }

    // Listen to all prep item sub-collections by fetching per-event
    // We use a simpler approach: snapshot the top-level prepItems collection
    // which stores items as events/<id>/prepItems
    const prepByEvent: Record<string, PreparationItem[]> = {};
    let resolved = 0;
    const total = staticEvents.length;

    if (total === 0) {
      setData(calculateAnalyticsData(staticEvents, {}));
      setLoading(false);
      return;
    }

    const unsubs: (() => void)[] = [];

    staticEvents.forEach(event => {
      const unsub = onSnapshot(
        collection(db, 'events', event.id, 'prepItems'),
        snap => {
          prepByEvent[event.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as PreparationItem));
          resolved++;
          if (resolved >= total) {
            setData(calculateAnalyticsData(staticEvents, prepByEvent));
            setLoading(false);
          }
        },
        () => {
          resolved++;
          if (resolved >= total) {
            setData(calculateAnalyticsData(staticEvents, prepByEvent));
            setLoading(false);
          }
        }
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [staticEvents.map(e => e.id).join(',')]);

  return { data, loading };
}
