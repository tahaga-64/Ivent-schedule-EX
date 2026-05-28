import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Event, FishItem } from '../types';
import { Fish, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  events: Event[];
  canEdit: boolean;
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  if (start === end) return `${sm}/${sd}`;
  return `${sm}/${sd}〜${e.getMonth() + 1}/${e.getDate()}`;
}

export default function FishListView({ events, canEdit }: Props) {
  const aquariumEvents = events
    .filter(ev => ev.type === '水族館' && ev.status !== 'cancelled')
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    return aquariumEvents[0]?.id ?? '';
  });

  const [fishItems, setFishItems] = useState<FishItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState<number>(1);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedEvent = aquariumEvents.find(ev => ev.id === selectedEventId);

  useEffect(() => {
    if (!selectedEventId) return;
    const unsub = onSnapshot(
      collection(db, 'events', selectedEventId, 'fishItems'),
      snap => {
        const items: FishItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FishItem));
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setFishItems(items);
      }
    );
    return unsub;
  }, [selectedEventId]);

  async function handleAdd() {
    if (!newName.trim() || !selectedEventId) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const item: FishItem = {
        id,
        name: newName.trim(),
        count: newCount,
        note: newNote.trim() || undefined,
        order: fishItems.length,
      };
      await setDoc(doc(db, 'events', selectedEventId, 'fishItems', id), item);
      setNewName('');
      setNewCount(1);
      setNewNote('');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!selectedEventId) return;
    await deleteDoc(doc(db, 'events', selectedEventId, 'fishItems', itemId));
  }

  async function handleCountChange(item: FishItem, count: number) {
    if (!selectedEventId) return;
    await setDoc(
      doc(db, 'events', selectedEventId, 'fishItems', item.id),
      { ...item, count },
      { merge: true }
    );
  }

  if (aquariumEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <Fish size={40} strokeWidth={1.5} />
        <p className="text-sm font-medium">水族館イベントがありません</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* イベント選択 */}
      <div className="mb-6">
        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
          水族館イベントを選択
        </label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          {aquariumEvents.map(ev => (
            <option key={ev.id} value={ev.id}>
              🐟 {ev.venue}
              {ev.start ? `（${fmtDateRange(ev.start, ev.end || ev.start)}）` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <>
          {/* ヘッダー */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Fish size={16} className="text-cyan-600" />
            </div>
            <div>
              <div className="font-black text-slate-800 text-sm">{selectedEvent.venue}</div>
              <div className="text-xs text-slate-400">
                {selectedEvent.start ? fmtDateRange(selectedEvent.start, selectedEvent.end || selectedEvent.start) : '日程未定'}
              </div>
            </div>
            <span className="ml-auto text-xs font-black text-cyan-600 bg-cyan-50 px-2 py-1 rounded-full">
              {fishItems.length}種
            </span>
          </div>

          {/* 魚リスト */}
          <div className="flex flex-col gap-2 mb-4">
            <AnimatePresence initial={false}>
              {fishItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-cyan-100"
                >
                  <span className="text-base">🐠</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800">{item.name}</div>
                    {item.note && (
                      <div className="text-xs text-slate-400 truncate">{item.note}</div>
                    )}
                  </div>
                  {canEdit ? (
                    <input
                      type="number"
                      min={0}
                      value={item.count}
                      onChange={e => handleCountChange(item, Number(e.target.value))}
                      className="w-16 text-center rounded-lg border border-slate-200 px-2 py-1 text-sm font-black text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    />
                  ) : (
                    <span className="text-sm font-black text-cyan-700 w-16 text-center">{item.count}</span>
                  )}
                  <span className="text-xs text-slate-400 -ml-1">匹</span>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {fishItems.length === 0 && (
              <div className="text-center py-10 text-slate-300 text-sm">
                観賞魚を追加してください
              </div>
            )}
          </div>

          {/* 追加フォーム */}
          {canEdit && (
            <div className="bg-cyan-50 rounded-2xl p-4 border border-cyan-100">
              <div className="text-xs font-black text-cyan-600 uppercase tracking-widest mb-3">
                観賞魚を追加
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="魚の名前（例：ネオンテトラ）"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="数量"
                    value={newCount}
                    onChange={e => setNewCount(Number(e.target.value))}
                    className="w-24 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <span className="flex items-center text-sm text-slate-500">匹</span>
                  <input
                    type="text"
                    placeholder="メモ（任意）"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    className="flex-1 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || saving}
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-200 text-white font-black text-sm py-2.5 transition-colors"
                >
                  <Plus size={14} />
                  追加
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
