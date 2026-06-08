import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Event, FishItem } from '../types';
import { Fish, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FISH_BG = "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920&q=80";

interface Props {
  events: Event[];
  canEdit: boolean;
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00');
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  if (!end || start === end) return `${sm}/${sd}`;
  const e = new Date(end + 'T00:00:00');
  return `${sm}/${sd}〜${e.getMonth() + 1}/${e.getDate()}`;
}

export default function FishListView({ events, canEdit }: Props) {
  const aquariumEvents = events
    .filter(ev => ev.type === '水族館' && ev.status !== 'cancelled')
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  const [selectedEventId, setSelectedEventId] = useState<string>(() => aquariumEvents[0]?.id ?? '');
  const [fishItems, setFishItems] = useState<FishItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState<number>(1);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { runWithGuard } = useUnsavedChanges();

  const selectedEvent = aquariumEvents.find(ev => ev.id === selectedEventId);

  const hasDraft = useMemo(
    () => !!(newName.trim() || newNote.trim() || newCount !== 1),
    [newName, newNote, newCount]
  );

  const clearDraft = useCallback(() => {
    setNewName('');
    setNewCount(1);
    setNewNote('');
    setError(null);
  }, []);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!newName.trim() || !selectedEventId) {
      clearDraft();
      return true;
    }
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const trimmedNote = newNote.trim();
      const item: FishItem = {
        id,
        name: newName.trim(),
        count: Number.isFinite(newCount) ? newCount : 0,
        order: fishItems.length,
      };
      if (trimmedNote) item.note = trimmedNote;
      await setDoc(doc(db, 'events', selectedEventId, 'fishItems', id), item);
      clearDraft();
      return true;
    } catch (err) {
      console.error('fishItems add error:', err);
      setError('保存に失敗しました。権限またはネットワークを確認してください。');
      return false;
    } finally {
      setSaving(false);
    }
  }, [newName, newNote, newCount, selectedEventId, fishItems.length, clearDraft]);

  useRegisterUnsavedGuard(`fish-draft-${selectedEventId}`, {
    enabled: canEdit && !!selectedEventId,
    hasUnsaved: hasDraft,
    save: saveDraft,
    discard: clearDraft,
  });

  useEffect(() => {
    if (!selectedEventId) return;
    const unsub = onSnapshot(
      collection(db, 'events', selectedEventId, 'fishItems'),
      snap => {
        const items: FishItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FishItem));
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setFishItems(items);
      },
      err => console.error('fishItems snapshot error:', err)
    );
    return unsub;
  }, [selectedEventId]);

  async function handleAdd() {
    if (!newName.trim() || !selectedEventId) return;
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const trimmedNote = newNote.trim();
      // Firestore は undefined を拒否するため、note が空なら項目自体を含めない
      const item: FishItem = {
        id,
        name: newName.trim(),
        count: Number.isFinite(newCount) ? newCount : 0,
        order: fishItems.length,
      };
      if (trimmedNote) item.note = trimmedNote;
      await setDoc(doc(db, 'events', selectedEventId, 'fishItems', id), item);
      setNewName('');
      setNewCount(1);
      setNewNote('');
    } catch (err) {
      console.error('fishItems add error:', err);
      setError('保存に失敗しました。権限またはネットワークを確認してください。');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!selectedEventId) return;
    try {
      await deleteDoc(doc(db, 'events', selectedEventId, 'fishItems', itemId));
    } catch (err) {
      console.error('fishItems delete error:', err);
    }
  }

  async function handleCountChange(item: FishItem, count: number) {
    if (!selectedEventId) return;
    const safeCount = Number.isFinite(count) ? count : 0;
    try {
      // count のみ更新（item 全体の再送をやめ、不要な書き込みを排除）
      await updateDoc(doc(db, 'events', selectedEventId, 'fishItems', item.id), { count: safeCount });
    } catch (err) {
      console.error('fishItems update error:', err);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 w-full max-w-none px-4 md:px-6 lg:px-8 py-6 pb-28 md:pb-8">

        {aquariumEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/60">
            <Fish size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">水族館イベントがありません</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">AQUARIUM</div>
              <h2 className="text-2xl font-black text-white">魚リスト</h2>
            </div>

            {/* イベント選択 */}
            <div className="mb-6">
              <label className="block text-xs font-black text-white/70 uppercase tracking-widest mb-2">
                水族館イベントを選択
              </label>
              <select
                value={selectedEventId}
                onChange={e => runWithGuard(() => setSelectedEventId(e.target.value))}
                className="w-full rounded-xl border border-white/20 bg-white/15 backdrop-blur-sm px-3 py-2.5 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                {aquariumEvents.map(ev => (
                  <option key={ev.id} value={ev.id} className="text-slate-800 bg-white">
                    {ev.venue}{ev.start ? `（${fmtDateRange(ev.start, ev.end || ev.start)}）` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedEvent && (
              <div className="md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:gap-6 xl:gap-8 md:items-start">
              <div className="md:sticky md:top-4 space-y-4">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
                  <div className="w-9 h-9 rounded-xl bg-cyan-400/30 flex items-center justify-center shrink-0">
                    <Fish size={18} className="text-cyan-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white text-sm truncate">{selectedEvent.venue}</div>
                    <div className="text-xs text-white/60 truncate">
                      {selectedEvent.start ? fmtDateRange(selectedEvent.start, selectedEvent.end || selectedEvent.start) : '日程未定'}
                    </div>
                  </div>
                  <span className="ml-auto shrink-0 text-xs font-black text-cyan-300 bg-cyan-900/40 px-3 py-1 rounded-full border border-cyan-400/30">
                    {fishItems.length}種
                  </span>
                </div>

                {canEdit && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-cyan-400/20">
                    <div className="text-xs font-black text-cyan-300 uppercase tracking-widest mb-3">観賞魚を追加</div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="魚の名前（例：ネオンテトラ）"
                        value={newName}
                        onChange={e => { setNewName(e.target.value); setError(null); }}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        className="w-full rounded-xl border border-white/20 bg-white/15 text-white placeholder-white/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                      <div className="flex gap-2 overflow-hidden">
                        <input
                          type="number"
                          min={0}
                          value={newCount}
                          onChange={e => setNewCount(Number(e.target.value))}
                          className="w-24 shrink-0 rounded-xl border border-white/20 bg-white/15 text-white placeholder-white/40 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        />
                        <span className="flex items-center text-sm text-white/60 shrink-0">匹</span>
                        <input
                          type="text"
                          placeholder="メモ（任意）"
                          value={newNote}
                          onChange={e => setNewNote(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAdd()}
                          className="flex-1 min-w-0 rounded-xl border border-white/20 bg-white/15 text-white placeholder-white/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                        />
                      </div>
                      <button
                        onClick={handleAdd}
                        disabled={!newName.trim() || saving}
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/20 disabled:text-white/40 text-white font-black text-sm py-2.5 transition-colors"
                      >
                        <Plus size={14} />
                        {saving ? '追加中...' : '追加'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {error && (
                  <div className="mb-3 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2 text-xs text-red-200 font-bold">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mb-4">
                  <AnimatePresence initial={false}>
                    {fishItems.map(item => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-cyan-100"
                      >
                        <span className="text-lg shrink-0">🐠</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-800">{item.name}</div>
                          {item.note && <div className="text-xs text-slate-400 truncate">{item.note}</div>}
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
                          <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1 shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {fishItems.length === 0 && (
                    <div className="text-center py-10 text-white/40 text-sm bg-white/5 rounded-2xl border border-white/10">
                      観賞魚を追加してください
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
