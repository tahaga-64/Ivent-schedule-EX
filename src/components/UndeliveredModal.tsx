import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Truck } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeOrderStatus } from '../lib/orderStatus';
import { notifyPush } from '../lib/pushNotifications';
import type { Event, PreparationItem } from '../types';

interface UndeliveredItem extends PreparationItem {
  eventId: string;
  eventVenue: string;
}

interface Props {
  events: Event[];
  onClose: () => void;
}

export default function UndeliveredModal({ events, onClose }: Props) {
  const [items, setItems] = useState<UndeliveredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    const activeEvents = events.filter(
      e => e.status !== 'cancelled' && e.status !== 'completed',
    );
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const nested = await Promise.all(
          activeEvents.map(async ev => {
            const snap = await getDocs(
              collection(db, `events/${ev.id}/preparationItems`),
            );
            return snap.docs
              .map(d => ({
                id: d.id,
                eventId: ev.id,
                eventVenue: ev.venue,
                ...d.data(),
              } as UndeliveredItem))
              .filter(
                item =>
                  item.name?.trim() &&
                  normalizeOrderStatus(item.orderStatus) !== 'completed',
              );
          }),
        );

        const flat = nested
          .flat()
          .sort((a, b) => {
            const sa = normalizeOrderStatus(a.orderStatus);
            const sb = normalizeOrderStatus(b.orderStatus);
            if (sa !== sb) return sa === 'ordered' ? -1 : 1;
            const ev = a.eventVenue.localeCompare(b.eventVenue, 'ja');
            if (ev !== 0) return ev;
            return (a.order ?? 0) - (b.order ?? 0);
          });

        if (!cancelled) setItems(flat);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [events]);

  const handleMarkComplete = useCallback(
    async (item: UndeliveredItem) => {
      const key = `${item.eventId}-${item.id}`;
      if (completing === key) return;
      setCompleting(key);
      try {
        await updateDoc(
          doc(db, `events/${item.eventId}/preparationItems/${item.id}`),
          { orderStatus: 'completed' },
        );
        setItems(prev =>
          prev.filter(i => !(i.id === item.id && i.eventId === item.eventId)),
        );
        notifyPush({
          type: 'prep_arrived',
          title: '配達完了',
          message: `「${item.name}」が届きました（${item.eventVenue}）`,
          eventId: item.eventId,
        });
      } catch (err) {
        console.error('Failed to mark as complete:', err);
      } finally {
        setCompleting(null);
      }
    },
    [completing],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { eventId: string; venue: string; items: UndeliveredItem[] }>();
    for (const item of items) {
      if (!map.has(item.eventId)) {
        map.set(item.eventId, { eventId: item.eventId, venue: item.eventVenue, items: [] });
      }
      map.get(item.eventId)!.items.push(item);
    }
    return [...map.values()];
  }, [items]);

  const statusStyle = (status: string | undefined) => {
    const s = normalizeOrderStatus(status);
    return s === 'ordered'
      ? { dot: 'bg-sky-400', badge: 'bg-sky-50 text-sky-700 border-sky-200', label: '発注済み' }
      : { dot: 'bg-slate-300', badge: 'bg-slate-50 text-slate-500 border-slate-200', label: '未発注' };
  };

  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[85dvh] flex flex-col overflow-hidden border-t border-slate-200 shadow-2xl"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Truck size={15} className="text-sky-500" />
                <h2 className="text-base font-black text-slate-900">未着一覧</h2>
                {!loading && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {items.length}件
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                完了マークされていない準備物を表示中
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
            >
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 pt-3 pb-10 flex-1">
            {loading ? (
              <div className="py-12 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
                読み込み中…
              </div>
            ) : groups.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3">
                <CheckCircle size={36} className="text-emerald-400" />
                <div className="text-sm font-black text-slate-700">未着の準備物はありません</div>
                <div className="text-xs text-slate-400">すべて配達完了しています</div>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map(group => (
                  <div key={group.eventId}>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">
                      {group.venue}
                    </div>
                    <div className="space-y-2">
                      {group.items.map(item => {
                        const sc = statusStyle(item.orderStatus);
                        const key = `${item.eventId}-${item.id}`;
                        const isCompleting = completing === key;
                        return (
                          <div
                            key={key}
                            className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">
                                {item.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${sc.badge}`}>
                                  {sc.label}
                                </span>
                                {item.quantity > 1 && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {item.quantity}個
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleMarkComplete(item)}
                              disabled={isCompleting}
                              className="shrink-0 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 active:scale-95 text-white text-[11px] font-black px-3 py-2 rounded-xl transition-all"
                            >
                              {isCompleting ? (
                                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              ) : (
                                <CheckCircle size={12} />
                              )}
                              配達完了
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>,
    document.body,
  );
}
