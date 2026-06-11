import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Event, FishItem } from '../types';
import { Fish, Plus, Trash2, Waves, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notifyPush, isPushNotificationConfigured } from '../lib/pushNotifications';
import { fmtDateJPFull } from '../lib/eventHelpers';

interface Props {
  events: Event[];
  /** 編集可否（魚リストはデスクトップのログイン済みユーザーのみ。スマホは閲覧専用＝canEditFishList が false） */
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

      {/* ヘッダー：水族館グラデーション */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-600 via-teal-600 to-blue-700 px-4 md:px-6 lg:px-8 pt-8 pb-16">
        <div className="absolute inset-0 opacity-10">
          <Waves size={300} className="absolute -bottom-12 -right-8 text-white" strokeWidth={0.5} />
        </div>
        <div className="relative z-10">
          <div className="text-[10px] font-black text-cyan-200 uppercase tracking-[0.2em] mb-1">AQUARIUM</div>
          <h2 className="text-3xl font-black text-white leading-tight">魚リスト</h2>
          {selectedEvent && (
            <div className="mt-2 flex items-center gap-2 text-cyan-100">
              <Fish size={14} />
              <span className="text-sm font-bold">{selectedEvent.venue}</span>
              {selectedEvent.start && (
                <span className="text-xs text-cyan-200">
                  {fmtDateRange(selectedEvent.start, selectedEvent.end || selectedEvent.start)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 合計バッジ */}
        {selectedEvent && fishItems.length > 0 && (
          <div className="absolute top-6 right-4 md:right-6 flex flex-col items-end gap-1">
            <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-4 py-2 text-center">
              <div className="text-2xl font-black text-white tabular-nums leading-none">{totalFishCount}</div>
              <div className="text-[10px] font-bold text-cyan-100">匹</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-3 py-1 text-center">
              <div className="text-sm font-black text-white tabular-nums leading-none">{fishItems.length}</div>
              <div className="text-[9px] font-bold text-cyan-100">種類</div>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-8 w-full max-w-none px-4 md:px-6 lg:px-8 pb-28 md:pb-8">

        {aquariumEvents.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <Fish size={36} strokeWidth={1.5} />
            <p className="text-sm font-medium">水族館イベントがありません</p>
          </div>
        ) : (
          <>
            {/* イベント選択 */}
            <div className="mb-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-1">
              {aquariumEvents.length === 1 ? (
                <div className="px-4 py-3 flex items-center gap-2">
                  <Fish size={15} className="text-cyan-500 shrink-0" />
                  <span className="text-sm font-black text-slate-900">{aquariumEvents[0].venue}</span>
                  {aquariumEvents[0].start && (
                    <span className="ml-auto text-xs text-slate-400 shrink-0">
                      {fmtDateRange(aquariumEvents[0].start, aquariumEvents[0].end || aquariumEvents[0].start)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex gap-1 overflow-x-auto p-2 scrollbar-hide">
                  {aquariumEvents.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => runWithGuard(() => setSelectedEventId(ev.id))}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedEventId === ev.id
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Fish size={12} />
                      <span>{ev.venue}</span>
                      {ev.start && (
                        <span className={`text-[10px] ${selectedEventId === ev.id ? 'text-cyan-200' : 'text-slate-400'}`}>
                          {fmtDateRange(ev.start, ev.end || ev.start)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedEvent && (
              <div className="md:grid md:grid-cols-[minmax(260px,320px)_1fr] md:gap-6 xl:gap-8 md:items-start">

                {/* 左カラム：入力フォーム */}
                <div className="md:sticky md:top-4 space-y-3 mb-5 md:mb-0">
                  {canEdit && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <div className="text-[10px] font-black text-cyan-700 uppercase tracking-widest mb-3">
                          観賞魚を追加
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <input
                            type="text"
                            placeholder="魚の名前（例：ネオンテトラ）"
                            value={newName}
                            onChange={e => { setNewName(e.target.value); setError(null); }}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition-colors"
                          />
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-cyan-400 focus-within:border-transparent transition-all">
                              <input
                                type="number"
                                min={0}
                                value={newCount}
                                onChange={e => setNewCount(Number(e.target.value))}
                                className="w-14 text-center bg-transparent text-sm font-black text-slate-900 focus:outline-none tabular-nums"
                              />
                              <span className="text-xs text-slate-500 shrink-0">匹</span>
                            </div>
                            <input
                              type="text"
                              placeholder="メモ（任意）"
                              value={newNote}
                              onChange={e => setNewNote(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAdd()}
                              className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 pt-2">
                        <button
                          onClick={handleAdd}
                          disabled={!newName.trim() || saving}
                          className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-400 text-white font-black text-sm py-2.5 transition-all shadow-sm disabled:shadow-none"
                        >
                          <Plus size={14} strokeWidth={3} />
                          {saving ? '追加中...' : '追加する'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 合計サマリー（モバイル用） */}
                  {fishItems.length > 0 && (
                    <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
                        <Fish size={16} className="text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-500 font-medium">登録済み</div>
                        <div className="font-black text-slate-900 text-sm">{fishItems.length}種 / {totalFishCount}匹</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 右カラム：魚リスト */}
                <div className="min-w-0">
                  {error && (
                    <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-800 font-bold">
                      {error}
                    </div>
                  )}

                  {fishItems.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-16 text-center">
                      <Fish size={32} className="mx-auto mb-3 text-slate-300" strokeWidth={1.5} />
                      <div className="text-sm font-bold text-slate-400">観賞魚が登録されていません</div>
                      {canEdit && <div className="text-xs mt-1 text-slate-300">フォームから追加してください</div>}
                    </div>
                  ) : (
                    <>
                      {/* PC用 合計ヘッダー */}
                      <div className="hidden md:flex items-center justify-between gap-3 mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">登録一覧</span>
                        <span className="text-xs font-black text-slate-500 tabular-nums bg-slate-100 rounded-full px-3 py-1">
                          {fishItems.length}種 / 合計 {totalFishCount}匹
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <AnimatePresence initial={false}>
                          {fishItems.map((item, index) => (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.15 }}
                              className="bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-cyan-200 hover:shadow-sm transition-all group relative overflow-hidden"
                            >
                              {/* 通し番号 */}
                              <div className="absolute top-2.5 left-3 text-[10px] font-black text-slate-300 tabular-nums">
                                #{index + 1}
                              </div>

                              {/* 削除ボタン */}
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
                                  <div className="flex items-center gap-1 bg-cyan-50 border border-cyan-100 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-cyan-300 transition-all">
                                    <input
                                      type="number"
                                      min={0}
                                      value={item.count}
                                      onChange={e => handleCountChange(item, Number(e.target.value))}
                                      aria-label={`${item.name}の匹数`}
                                      className="w-10 text-center bg-transparent text-sm font-black tabular-nums text-cyan-800 focus:outline-none"
                                    />
                                    <span className="text-xs text-cyan-600 font-bold">匹</span>
                                  </div>
                                ) : (
                                  <span className="bg-cyan-50 border border-cyan-100 text-cyan-800 font-black text-sm tabular-nums px-2.5 py-1 rounded-lg">
                                    {item.count}<span className="text-xs font-bold ml-0.5">匹</span>
                                  </span>
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
                    </>
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
