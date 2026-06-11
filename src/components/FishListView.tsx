import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Event, FishItem } from '../types';
import { Fish, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notifyPush, isPushNotificationConfigured } from '../lib/pushNotifications';
import { fmtDateJPFull } from '../lib/eventHelpers';

interface Props {
  events: Event[];
  canEdit: boolean;
  isActive?: boolean;
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00');
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  if (!end || start === end) return `${sm}/${sd}`;
  const e = new Date(end + 'T00:00:00');
  return `${sm}/${sd}〜${e.getMonth() + 1}/${e.getDate()}`;
}

function isEventPast(ev: Event): boolean {
  const today = new Date().toISOString().split('T')[0];
  const endDate = ev.end || ev.start;
  return !!endDate && endDate < today;
}

export default function FishListView({ events, canEdit, isActive = true }: Props) {
  const aquariumEvents = useMemo(
    () => events
      .filter(ev => ev.type === '水族館' && ev.status !== 'cancelled' && !isEventPast(ev))
      .sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    [events]
  );

  const [selectedEventId, setSelectedEventId] = useState<string>(() => aquariumEvents[0]?.id ?? '');
  const [fishItems, setFishItems] = useState<FishItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState<number>(1);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { runWithGuard } = useUnsavedChanges();

  const selectedEvent = aquariumEvents.find(ev => ev.id === selectedEventId);

  const totalFishCount = useMemo(
    () => fishItems.reduce((sum, item) => sum + (Number.isFinite(item.count) ? item.count : 0), 0),
    [fishItems],
  );

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

  const notifyFishAdded = useCallback((name: string, count: number) => {
    if (!selectedEvent || !isPushNotificationConfigured()) return;
    const head = [selectedEvent.venue, fmtDateJPFull(selectedEvent.start)]
      .map(p => (p ?? '').trim())
      .filter(Boolean)
      .join(' / ');
    notifyPush({
      type: 'fish_added',
      title: '魚リストに追加されました',
      message: [head, `${name} ${count}匹`].filter(Boolean).join(' ・ '),
      eventId: selectedEvent.id,
    });
  }, [selectedEvent]);

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
      notifyFishAdded(item.name, item.count);
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
    if (aquariumEvents.length === 0) {
      setSelectedEventId('');
      return;
    }
    if (!aquariumEvents.some(ev => ev.id === selectedEventId)) {
      setSelectedEventId(aquariumEvents[0].id);
    }
  }, [aquariumEvents, selectedEventId]);

  useEffect(() => {
    if (!isActive || !selectedEventId) return;
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
  }, [isActive, selectedEventId]);

  async function handleAdd() {
    if (!newName.trim() || !selectedEventId) return;
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
      notifyFishAdded(item.name, item.count);
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
      await updateDoc(doc(db, 'events', selectedEventId, 'fishItems', item.id), { count: safeCount });
    } catch (err) {
      console.error('fishItems update error:', err);
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--bg-app)]">
      <div className="relative z-10 w-full max-w-none px-4 md:px-6 lg:px-8 py-6 pb-28 md:pb-8">

        {aquariumEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
            <Fish size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">水族館イベントがありません</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">AQUARIUM</div>
              <h2 className="text-2xl font-black text-slate-900">魚リスト</h2>
            </div>

            {/* イベント選択 */}
            <div className="mb-6">
              {aquariumEvents.length === 1 ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <Fish size={15} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-black text-slate-900">{aquariumEvents[0].venue}</span>
                  {aquariumEvents[0].start && (
                    <span className="ml-auto text-xs text-slate-400 shrink-0">
                      {fmtDateRange(aquariumEvents[0].start, aquariumEvents[0].end || aquariumEvents[0].start)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1">
                  <div className="flex gap-1 overflow-x-auto p-1 scrollbar-hide">
                    {aquariumEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => runWithGuard(() => setSelectedEventId(ev.id))}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          selectedEventId === ev.id
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Fish size={12} />
                        <span>{ev.venue}</span>
                        {ev.start && (
                          <span className={`text-[10px] ${selectedEventId === ev.id ? 'text-slate-300' : 'text-slate-400'}`}>
                            {fmtDateRange(ev.start, ev.end || ev.start)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedEvent && (
              <div className="md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:gap-6 xl:gap-8 md:items-start">
                <div className="md:sticky md:top-4 space-y-4">
                  {/* 合計バッジ */}
                  {fishItems.length > 0 && (
                    <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                        <Fish size={18} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-900 text-sm truncate">{selectedEvent.venue}</div>
                        <div className="text-xs text-slate-500">
                          {selectedEvent.start ? fmtDateRange(selectedEvent.start, selectedEvent.end || selectedEvent.start) : '日程未定'}
                        </div>
                      </div>
                      <span className="ml-auto shrink-0 text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                        {fishItems.length}種 / {totalFishCount}匹
                      </span>
                    </div>
                  )}

                  {canEdit && (
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">観賞魚を追加</div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="魚の名前（例：ネオンテトラ）"
                          value={newName}
                          onChange={e => { setNewName(e.target.value); setError(null); }}
                          onKeyDown={e => e.key === 'Enter' && handleAdd()}
                          className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                        <div className="flex gap-2 overflow-hidden">
                          <input
                            type="number"
                            min={0}
                            value={newCount}
                            onChange={e => setNewCount(Number(e.target.value))}
                            className="w-24 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-300"
                          />
                          <span className="flex items-center text-sm text-slate-500 shrink-0">匹</span>
                          <input
                            type="text"
                            placeholder="メモ（任意）"
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </div>
                        <button
                          onClick={handleAdd}
                          disabled={!newName.trim() || saving}
                          className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-sm py-2.5 transition-colors"
                        >
                          <Plus size={14} />
                          {saving ? '追加中...' : '追加'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 mt-4 md:mt-0">
                  {error && (
                    <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-800 font-bold">
                      {error}
                    </div>
                  )}

                  {fishItems.length > 0 && (
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">登録一覧</span>
                      <span className="text-sm font-black text-slate-800 tabular-nums">
                        {fishItems.length}種 / 合計 {totalFishCount}匹
                      </span>
                    </div>
                  )}

                  {fishItems.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <Fish size={32} className="mx-auto mb-3 opacity-50" />
                      <div className="text-sm">観賞魚が登録されていません</div>
                      {canEdit && <div className="text-xs mt-1 text-slate-400">左のフォームから追加してください</div>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <AnimatePresence initial={false}>
                        {fishItems.map((item, index) => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors group shadow-sm relative"
                          >
                            <div className="absolute top-2.5 left-3 text-[10px] font-black text-slate-300 tabular-nums">
                              #{index + 1}
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                aria-label={`${item.name}を削除`}
                                className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <div className="mt-3 mb-2">
                              <div className="font-black text-sm text-slate-900 leading-snug pr-4">{item.name}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {canEdit ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.count}
                                    onChange={e => handleCountChange(item, Number(e.target.value))}
                                    aria-label={`${item.name}の匹数`}
                                    className="w-16 text-center rounded-lg border border-slate-200 px-2 py-1 text-xs font-black tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  />
                                  <span className="text-xs text-slate-500">匹</span>
                                </>
                              ) : (
                                <span className="font-bold tabular-nums text-sm text-slate-900">{item.count}<span className="text-xs text-slate-500 ml-0.5">匹</span></span>
                              )}
                            </div>
                            {item.note && (
                              <div className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1 leading-snug">
                                {item.note}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
