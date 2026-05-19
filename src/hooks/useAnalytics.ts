import { useState, useEffect, useMemo } from 'react';
import { collectionGroup, onSnapshot } from 'firebase/firestore';
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

    const eventIdSet = new Set(staticEvents.map(e => e.id));

    const unsub = onSnapshot(
      collectionGroup(db, 'preparationItems'),
      snap => {
        const prepByEvent: Record<string, PreparationItem[]> = {};
        snap.docs.forEach(d => {
          const eventId = d.ref.parent.parent?.id;
          if (!eventId || !eventIdSet.has(eventId)) return;
          if (!prepByEvent[eventId]) prepByEvent[eventId] = [];
          prepByEvent[eventId].push({ id: d.id, ...d.data() } as PreparationItem);
        });
        setData(calculateAnalyticsData(staticEvents, prepByEvent));
        setPrepByEventState(prepByEvent);
        setLoading(false);
      },
      () => {
        setData(calculateAnalyticsData(staticEvents, {}));
        setLoading(false);
      }
    );

    return () => unsub();
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
