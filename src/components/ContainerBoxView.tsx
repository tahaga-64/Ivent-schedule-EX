/**
 * ContainerBoxView — コンテナボックス
 * イベントに持っていく備品の数量を備品マスターから選択し、確定するツール。
 * 保存時にマスターの在庫（defaultQuantity）を差分分だけ加減算する。
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Event, InventorySettlement } from '../types';
import { db } from '../lib/firebase';
import {
  collection, onSnapshot, doc, writeBatch, increment, serverTimestamp,
} from 'firebase/firestore';
import type { MasterItem } from './MasterItemsView';
import { applyInventorySettlement } from '../lib/inventorySettlement';
import { Boxes, ChevronRight, Minus, Plus, Save, Package, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  events: Event[];
  canEdit: boolean;
}

/** events/{eventId}/containerItems のドキュメント型 */
interface ContainerItem {
  masterItemId: string;
  name: string;
  quantity: number;
}

function fmtDateRange(start?: string, end?: string) {
  if (!start) return '';
  const s = new Date(start + 'T00:00:00');
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  if (!end || start === end) return `${sm}/${sd}`;
  const e = new Date(end + 'T00:00:00');
  return `${sm}/${sd}〜${e.getMonth() + 1}/${e.getDate()}`;
}

// ── イベント選択後の詳細ビュー ─────────────────────────────────────────────────

function ContainerDetail({
  event,
  canEdit,
  onBack,
}: {
  event: Event;
  canEdit: boolean;
  onBack: () => void;
}) {
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [savedContainer, setSavedContainer] = useState<Record<string, number>>({});
  const [localQty, setLocalQty] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const savedRef = useRef<Record<string, number>>({});
  const [localConsumed, setLocalConsumed] = useState<Record<string, number>>({});
  const [savedConsumed, setSavedConsumed] = useState<Record<string, number>>({});
  const [savedReturned, setSavedReturned] = useState<Record<string, number>>({});
  const [isSettling, setIsSettling] = useState(false);
  const [settleOk, setSettleOk] = useState(false);
  const settlementDirtyRef = useRef(false);

  // 備品マスター購読
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'masterItems'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as MasterItem[];
      list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setMasterItems(list);
    });
    return unsub;
  }, []);

  // このイベントのコンテナボックス購読
  useEffect(() => {
    const path = `events/${event.id}/containerItems`;
    const unsub = onSnapshot(collection(db, path), snap => {
      const map: Record<string, number> = {};
      snap.docs.forEach(d => {
        const data = d.data() as ContainerItem;
        map[data.masterItemId] = data.quantity;
      });
      setSavedContainer(map);
      setLocalQty(map);
      savedRef.current = map;
    });
    return unsub;
  }, [event.id]);

  // 在庫精算データ購読
  useEffect(() => {
    const path = `events/${event.id}/inventorySettlements`;
    const unsub = onSnapshot(collection(db, path), snap => {
      const returned: Record<string, number> = {};
      const consumed: Record<string, number> = {};
      snap.docs.forEach(d => {
        const data = d.data() as InventorySettlement;
        returned[data.masterItemId] = data.returnedQuantity ?? 0;
        consumed[data.masterItemId] = data.consumedQuantity ?? 0;
      });
      setSavedReturned(returned);
      setSavedConsumed(consumed);
      if (!settlementDirtyRef.current) {
        setLocalConsumed(consumed);
      }
    });
    return unsub;
  }, [event.id]);

  const settlementItems = useMemo(() => {
    return Object.entries(savedContainer)
      .filter(([, qty]) => qty > 0)
      .map(([masterItemId, takenQuantity]) => {
        const master = masterItems.find(m => m.id === masterItemId);
        return {
          masterItemId,
          name: master?.name ?? masterItemId,
          takenQuantity,
          consumedQuantity: localConsumed[masterItemId] ?? 0,
        } satisfies InventorySettlement;
      });
  }, [savedContainer, masterItems, localConsumed]);

  const settlementDirty = useMemo(() => {
    return settlementItems.some(s =>
      (localConsumed[s.masterItemId] ?? 0) !== (savedConsumed[s.masterItemId] ?? 0),
    );
  }, [settlementItems, localConsumed, savedConsumed]);

  useEffect(() => {
    settlementDirtyRef.current = settlementDirty;
  }, [settlementDirty]);

  const hasChanges = useMemo(() => {
    const saved = savedRef.current;
    return masterItems.some(m => (localQty[m.id] ?? 0) !== (saved[m.id] ?? 0));
  }, [localQty, masterItems]);

  const setQty = useCallback((masterItemId: string, qty: number) => {
    if (!canEdit) return;
    setLocalQty(prev => ({ ...prev, [masterItemId]: Math.max(0, qty) }));
  }, [canEdit]);

  const setConsumed = useCallback((masterItemId: string, qty: number) => {
    if (!canEdit) return;
    setLocalConsumed(prev => ({ ...prev, [masterItemId]: Math.max(0, qty) }));
  }, [canEdit]);

  const handleSettle = useCallback(async () => {
    if (!canEdit || isSettling || settlementItems.length === 0) return;
    setIsSettling(true);
    try {
      const payload = settlementItems.map(s => ({
        ...s,
        consumedQuantity: Math.min(localConsumed[s.masterItemId] ?? 0, s.takenQuantity),
      }));
      await applyInventorySettlement(event.id, payload, savedReturned);
      settlementDirtyRef.current = false;
      setSettleOk(true);
      setTimeout(() => setSettleOk(false), 2500);
    } catch (err) {
      console.error('Inventory settlement error:', err);
    } finally {
      setIsSettling(false);
    }
  }, [canEdit, isSettling, settlementItems, localConsumed, savedReturned, event.id]);

  const handleSave = useCallback(async () => {
    if (!canEdit || isSaving) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const containerPath = `events/${event.id}/containerItems`;

      for (const master of masterItems) {
        const prevQty = savedRef.current[master.id] ?? 0;
        const currQty = localQty[master.id] ?? 0;
        const delta = currQty - prevQty;
        if (delta === 0) continue;

        // コンテナアイテムを更新
        const containerRef = doc(db, containerPath, master.id);
        if (currQty === 0) {
          batch.delete(containerRef);
        } else {
          batch.set(containerRef, {
            masterItemId: master.id,
            name: master.name,
            quantity: currQty,
            updatedAt: serverTimestamp(),
          });
        }

        // マスターの在庫を差分だけ加減算（持ち出し増加→減算、返却→加算）
        batch.update(doc(db, 'masterItems', master.id), {
          defaultQuantity: increment(-delta),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      console.error('ContainerBox save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, isSaving, event.id, masterItems, localQty]);

  const totalItems = useMemo(
    () => masterItems.reduce((s, m) => s + (localQty[m.id] ?? 0), 0),
    [masterItems, localQty],
  );

  const selectedCount = useMemo(
    () => masterItems.filter(m => (localQty[m.id] ?? 0) > 0).length,
    [masterItems, localQty],
  );

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg-app)]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0 border-b border-slate-200 bg-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs font-bold transition-colors"
        >
          <ChevronRight size={14} className="rotate-180" />
          イベント一覧
        </button>
        {canEdit && hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-black px-3 py-1.5 rounded-xl transition-colors"
          >
            <Save size={13} />
            {isSaving ? '保存中...' : '保存する'}
          </button>
        )}
        <AnimatePresence>
          {saveOk && !hasChanges && (
            <motion.span
              className="text-xs font-black text-emerald-600"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              ✓ 保存しました
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 md:px-6 lg:px-8 py-6 pb-32 md:pb-8 w-full max-w-3xl">
        {/* タイトル */}
        <div className="mb-5">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">CONTAINER BOX</div>
          <h2 className="text-2xl font-black text-slate-900">{event.venue}</h2>
          <p className="text-xs text-slate-500 mt-1 font-mono">{fmtDateRange(event.start, event.end)}</p>
        </div>

        {/* サマリーバー */}
        <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 mb-5 text-xs font-bold text-indigo-700">
          <Boxes size={16} className="shrink-0" />
          <span>{selectedCount} 種類 / 合計 {totalItems} 個 を持っていく</span>
        </div>

        {/* 備品リスト */}
        {masterItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package size={32} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm">備品マスターにアイテムがありません</div>
            <div className="text-xs mt-1">備品マスターページからアイテムを追加してください</div>
          </div>
        ) : (
          <div className="space-y-2">
            {masterItems.map(master => {
              const qty = localQty[master.id] ?? 0;
              const saved = savedRef.current[master.id] ?? 0;
              const changed = qty !== saved;
              const stock = master.defaultQuantity;
              return (
                <div
                  key={master.id}
                  className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border transition-colors ${
                    qty > 0 ? 'border-indigo-200 shadow-sm' : 'border-slate-200'
                  }`}
                >
                  {/* アイテム情報 */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-black truncate ${qty > 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                      {master.name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      {master.unitPrice > 0 && (
                        <span className="font-mono">¥{master.unitPrice.toLocaleString()}</span>
                      )}
                      <span className={`font-bold ${stock <= 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        在庫 {stock}個
                      </span>
                      {changed && (
                        <span className="text-amber-500 font-black">● 変更あり</span>
                      )}
                    </div>
                  </div>

                  {/* 数量コントロール */}
                  {canEdit ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(master.id, qty - 1)}
                        className="w-7 h-7 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-30"
                        disabled={qty === 0}
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <span className={`w-8 text-center text-sm font-black tabular-nums ${qty > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(master.id, qty + 1)}
                        className="w-7 h-7 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <span className={`text-sm font-black tabular-nums ${qty > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                      {qty}個
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* イベント終了時の在庫精算 */}
        {settlementItems.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">イベント終了・在庫精算</h3>
              </div>
              {canEdit && settlementDirty && (
                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={isSettling}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Save size={13} />
                  {isSettling ? '反映中...' : '精算を反映'}
                </button>
              )}
              <AnimatePresence>
                {settleOk && !settlementDirty && (
                  <motion.span
                    className="text-xs font-black text-emerald-600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    ✓ マスター在庫を更新しました
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              持ち出した備品のうち、イベントで減った（消費・破損等）個数を入力してください。エプロンや芝など減らないものは 0 のままで構いません。未消費分は備品マスターへ自動返却されます。
            </p>
            <div className="space-y-2">
              {settlementItems.map(item => {
                const consumed = localConsumed[item.masterItemId] ?? 0;
                const clamped = Math.min(consumed, item.takenQuantity);
                const returned = item.takenQuantity - clamped;
                return (
                  <div key={item.masterItemId} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-slate-200">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-slate-900 truncate">{item.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        持ち出し {item.takenQuantity}個 → 返却予定 {returned}個
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-black text-slate-500 mb-0.5">減った個数</div>
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          max={item.takenQuantity}
                          value={consumed}
                          onChange={e => setConsumed(item.masterItemId, parseInt(e.target.value) || 0)}
                          className="w-16 text-center text-sm font-black border border-slate-200 rounded-lg py-1.5 font-mono"
                        />
                      ) : (
                        <span className="text-sm font-black font-mono">{consumed}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function ContainerBoxView({ events, canEdit }: Props) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const active = useMemo(
    () => [...events]
      .filter(e => e.status !== 'cancelled')
      .filter(e => !(e.end && e.end < today))
      .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999')),
    [events, today],
  );

  const selectedEvent = active.find(e => e.id === selectedEventId);

  if (selectedEvent) {
    return (
      <ContainerDetail
        event={selectedEvent}
        canEdit={canEdit}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  return (
    <div className="relative flex flex-col min-h-full bg-[var(--bg-app)]">
      <div className="relative z-10 px-4 md:px-6 lg:px-8 py-6 pb-32 md:pb-8 w-full max-w-none">
        <div className="mb-6">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">CONTAINER BOX</div>
          <h2 className="text-2xl font-black text-slate-900">コンテナボックス</h2>
          <p className="text-xs text-slate-500 mt-1">イベントに持っていく備品を計算・確認するツールです</p>
        </div>

        {active.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Boxes size={32} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm">イベントがありません</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
            {active.map(ev => (
              <motion.button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEventId(ev.id)}
                whileTap={{ scale: 0.98 }}
                className="group text-left bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex items-center gap-3"
              >
                <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Boxes size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900 truncate">{ev.venue}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{fmtDateRange(ev.start, ev.end)}</div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
