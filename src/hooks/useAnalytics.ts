import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event, PreparationItem, AnalyticsData } from '../types';
import { calculateAnalyticsData } from '../lib/analytics';

export function useAnalytics(staticEvents: Event[]) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [prepByEventState, setPrepByEventState] = useState<Record<string, PreparationItem[]>>({});

  const eventIds = useMemo(
    () => staticEvents.map(e => e.id).join(','),
    [staticEvents],
  );

  useEffect(() => {
    if (staticEvents.length === 0) {
      setData(calculateAnalyticsData([], {}));
      setLoading(false);
      setPrepByEventState({});
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
      setPrepByEventState({});
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
            setPrepByEventState({ ...prepByEvent });
            setLoading(false);
          }
        },
        () => {
          resolved++;
          if (resolved >= total) {
            setData(calculateAnalyticsData(staticEvents, prepByEvent));
            setPrepByEventState({ ...prepByEvent });
            setLoading(false);
          }
        }
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [eventIds]);

  const prepProgress: Record<string, { prepared: number; total: number }> = {};
  Object.entries(prepByEventState).forEach(([id, items]) => {
    prepProgress[id] = {
      prepared: items.filter(i => i.prepared).length,
      total: items.length,
    };
  });
  return { data, loading, prepProgress };
}
