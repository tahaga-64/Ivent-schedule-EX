import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { PreparationItem, Event } from '../types';
import { Trash2, Plus, ArrowLeft, Save, ExternalLink, ClipboardList, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  event: Event;
  onBack: () => void;
  /** 準備物の追加・編集・保存・削除を許可するか（ログイン済みなら true を渡す想定） */
  canEdit: boolean;
}

function createEmptyItem(order: number): PreparationItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    shippingFee: 0,
    arrived: false,
    prepared: false,
    note: '',
    url: '',
    order,
  };
}

function isEmptyItem(item: PreparationItem): boolean {
  return (
    !item.name?.trim() &&
    !item.note?.trim() &&
    !item.url?.trim() &&
    (item.quantity ?? 1) === 1 &&
    !item.unitPrice &&
    !item.amount &&
    !item.shippingFee &&
    !item.arrived &&
    !item.prepared
  );
}

function normalizeInitialItems(items: PreparationItem[]): PreparationItem[] {
  const filledItems = items.filter(item => !isEmptyItem(item));
  return filledItems.length > 0 ? filledItems : [createEmptyItem(0)];
}

function formatSaveError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return '保存に失敗しました：権限がありません。編集権限のあるアカウントでログインしているか確認してください。';
  }
  if (lower.includes('unavailable') || lower.includes('offline') || lower.includes('network')) {
    return '保存に失敗しました：ネットワーク接続を確認してください。';
  }
  return '保存に失敗しました。もう一度お試しください。';
}

function handlePrint() {
  window.print();
}

export default function PreparationList({ event, onBack, canEdit }: Props) {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  useEffect(() => {
    const path = `events/${event.id}/preparationItems`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PreparationItem));
      if (hasChangesRef.current) {
        // While editing, only remove items deleted remotely — do NOT overwrite local edits
        const remoteIds = new Set(data.map(i => i.id));
        setItems(prev => prev.filter(i => remoteIds.has(i.id)));
        return;
      }
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setItems(normalizeInitialItems(data));
    }, (error) => {
      console.error('PreparationList load error:', error);
    });
    return () => unsubscribe();
  }, [event.id]); // hasChanges は ref 経由で参照するため deps 不要

  const handleSaveAll = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await Promise.all(items.map(item =>
        setDoc(doc(db, `events/${event.id}/preparationItems`, item.id), item)
      ));
      const total = items.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0);
      updateDoc(doc(db, 'events', event.id), { prepBudgetTotal: total }).catch(() => {});
      setHasChanges(false);
      setIsSaving(false);
    } catch (error) {
      console.error('PreparationList save error:', error);
      setSaveError(formatSaveError(error));
      setIsSaving(false);
    }
  };

  const updateItem = (id: string, updates: Partial<PreparationItem>) => {
    if (!canEdit) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newItem = { ...item, ...updates };
    newItem.amount = (newItem.quantity || 0) * (newItem.unitPrice || 0);
    setItems(prev => prev.map(i => i.id === id ? newItem : i));
    setHasChanges(true);
  };

  const addItem = () => {
    if (!canEdit) return;
    setItems(prev => [...prev, createEmptyItem(prev.length)]);
    setHasChanges(true);
  };

  const removeItem = async (id: string) => {
    if (!canEdit) return;
    if (items.length <= 1) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await deleteDoc(doc(db, `events/${event.id}/preparationItems`, id));
      setItems(prev => prev.filter(i => i.id !== id));
      setIsSaving(false);
    } catch (error) {
      console.error('PreparationList delete error:', error);
      setSaveError(formatSaveError(error));
      setIsSaving(false);
    }
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
    const shipping = items.reduce((s, i) => s + (i.shippingFee || 0), 0);
    const arrived = items.filter(i => i.arrived).length;
    const prepared = items.filter(i => i.prepared).length;
    const done = items.filter(i => i.arrived && i.prepared).length;
    return { subtotal, shipping, total: subtotal + shipping, arrived, prepared, done };
  }, [items]);


  return (
    <div
      id="prep-print-area"
      data-print-title={`${event.venue}　準備物リスト　${event.start}〜${event.end}`}
      className="flex flex-col h-full bg-[var(--bg-app)]"
    >
      {!canEdit && (
        <div className="px-5 py-2.5 bg-[var(--surface-tertiary)] border-b border-[var(--separator)] text-[var(--text-secondary)] text-footnote text-center">
          閲覧のみ
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          onClick={() => setSaveError(null)}
          className="px-5 py-3 bg-[var(--color-danger-bg)] border-b border-[var(--color-danger)]/20 text-[var(--color-danger)] text-footnote flex items-center gap-2 cursor-pointer"
        >
          <span className="flex-1">{saveError}</span>
          <span className="text-caption2 opacity-60">タップで閉じる</span>
        </div>
      )}
      
      {/* Navigation bar - clean, minimal */}
      <div className="flex items-center justify-between px-4 h-12 glass-nav shrink-0 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#007AFF] text-body active:opacity-50 transition-opacity touch-target"
        >
          <ArrowLeft size={20} strokeWidth={2} />
          <span>戻る</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="touch-target text-[#007AFF] active:opacity-50 transition-opacity print:hidden"
            title="印刷"
          >
            <Printer size={20} strokeWidth={1.8} />
          </button>
          {hasChanges && canEdit && (
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 h-8 bg-[#007AFF] text-white rounded-full text-subheadline font-medium active:opacity-80 transition-opacity disabled:opacity-50"
            >
              <Save size={14} />
              {isSaving ? '保存中' : '保存'}
            </button>
          )}
        </div>
      </div>

      {/* Event header - editorial typography */}
      <div className="px-5 pt-6 pb-4 border-b border-[var(--separator)]">
        <h1 className="text-title2 text-[var(--text-primary)]">{event.venue}</h1>
        <p className="text-subheadline text-[var(--text-secondary)] mt-1">{event.start} → {event.end}</p>
      </div>

      {/* Mobile card list - clean, intentional */}
      <div className="block lg:hidden flex-1 overflow-y-auto p-5 space-y-3">
        {!canEdit && items.filter(i => !isEmptyItem(i)).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)]">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-tertiary)] flex items-center justify-center mb-4">
              <ClipboardList size={28} strokeWidth={1.5} />
            </div>
            <p className="text-headline text-[var(--text-secondary)] text-center">準備物がありません</p>
          </div>
        )}
        {items.filter(item => canEdit || !isEmptyItem(item)).map((item, idx) => (
          <div
            key={item.id}
            className={`bg-[var(--surface)] rounded-2xl overflow-hidden border border-[var(--border)] ${item.prepared ? 'opacity-50' : ''}`}
          >
            {/* Row 1: Item name */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <span className="text-caption1 text-[var(--text-tertiary)] font-medium w-5 shrink-0 tabular-nums">{idx + 1}</span>
              <input
                type="text"
                readOnly={!canEdit}
                value={item.name}
                onChange={e => updateItem(item.id, { name: e.target.value })}
                placeholder="アイテム名"
                className={`flex-1 text-body font-medium text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-tertiary)] read-only:cursor-default ${item.prepared ? 'line-through text-[var(--text-secondary)]' : ''}`}
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1 || !canEdit}
                className={`touch-target shrink-0 transition-opacity ${
                  items.length <= 1 ? 'opacity-0 pointer-events-none' : !canEdit ? 'opacity-20 cursor-not-allowed' : 'text-[var(--text-tertiary)] active:opacity-50'
                }`}
              >
                <Trash2 size={18} strokeWidth={1.5} />
              </button>
            </div>
            
            {/* Row 2: Numbers grid */}
            <div className="grid grid-cols-3 border-t border-[var(--separator)]">
              <div className="px-4 py-3 border-r border-[var(--separator)]">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-1">数量</div>
                <input
                  type="number"
                  readOnly={!canEdit}
                  value={item.quantity || ''}
                  onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                  className="w-full text-body text-[var(--text-primary)] bg-transparent outline-none tabular-nums read-only:cursor-default"
                />
              </div>
              <div className="px-4 py-3 border-r border-[var(--separator)]">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-1">単価</div>
                <div className="flex items-center">
                  <span className="text-footnote text-[var(--text-tertiary)] mr-0.5">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.unitPrice || ''}
                    onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                    className="w-full text-body text-[var(--text-primary)] bg-transparent outline-none tabular-nums read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="px-4 py-3 bg-[#007AFF]/5">
                <div className="text-caption2 text-[#007AFF] mb-1">金額</div>
                <div className="text-body font-semibold text-[#007AFF] tabular-nums">¥{(item.amount || 0).toLocaleString()}</div>
              </div>
            </div>
            
            {/* Row 3: Shipping + checkboxes */}
            <div className="grid grid-cols-3 border-t border-[var(--separator)]">
              <div className="px-4 py-3 border-r border-[var(--separator)]">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-1">配送料</div>
                <div className="flex items-center">
                  <span className="text-footnote text-[var(--text-tertiary)] mr-0.5">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.shippingFee || ''}
                    onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-body text-[var(--text-primary)] bg-transparent outline-none tabular-nums read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="px-4 py-3 flex flex-col items-center justify-center border-r border-[var(--separator)]">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-2">到着</div>
                <Checkbox checked={item.arrived} disabled={!canEdit} onChange={() => updateItem(item.id, { arrived: !item.arrived })} />
              </div>
              <div className="px-4 py-3 flex flex-col items-center justify-center">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-2">準備完了</div>
                <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
              </div>
            </div>
            
            {/* Note field */}
            {(item.note || canEdit) && (
              <div className="border-t border-[var(--separator)] px-4 py-3">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-1">備考</div>
                <PreparationNoteField value={item.note || ''} readOnly={!canEdit} onChange={note => updateItem(item.id, { note })} />
              </div>
            )}
            
            {/* URL field */}
            {(item.url || canEdit) && (
              <div className="border-t border-[var(--separator)] px-4 py-3">
                <div className="text-caption2 text-[var(--text-tertiary)] mb-1">URL</div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.url || ''}
                      onChange={e => updateItem(item.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 text-subheadline text-[#007AFF] bg-transparent outline-none min-w-0 placeholder:text-[var(--text-tertiary)]"
                    />
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[#007AFF] active:opacity-50 touch-target">
                        <ExternalLink size={18} strokeWidth={1.5} />
                      </a>
                    )}
                  </div>
                ) : item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-subheadline text-[#007AFF] break-all">
                    {item.url}
                  </a>
                ) : null}
              </div>
            )}
          </div>
        ))}
        
        {canEdit && (
          <button
            type="button"
            onClick={addItem}
            className="w-full py-4 bg-[var(--surface)] text-[#007AFF] text-subheadline font-medium rounded-2xl border border-[var(--border)] active:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus size={18} strokeWidth={2} /> 項目を追加
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block flex-1 overflow-auto p-6">
        {!canEdit && items.filter(i => !isEmptyItem(i)).length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <ClipboardList size={40} className="mb-3" />
            <p className="text-sm font-bold text-slate-400">準備物が登録されていません</p>
          </div>
        )}
        {(canEdit || items.filter(i => !isEmptyItem(i)).length > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '1100px' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center border-r border-gray-100">#</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '220px' }}>品名</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center border-r border-gray-100">数量</th>
                  <th className="w-28 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right border-r border-gray-100">単価</th>
                  <th className="w-32 px-3 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right border-r border-gray-100 bg-indigo-50/40">金額</th>
                  <th className="w-28 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right border-r border-gray-100">配送料</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center border-r border-gray-100 bg-emerald-50/40">到着</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-r border-gray-100 bg-indigo-50/40">準備完了</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '280px' }}>備考</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '160px' }}>URL</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`group transition-colors ${
                      item.prepared ? 'bg-indigo-50/20' : item.arrived ? 'bg-emerald-50/20' : 'bg-white'
                    } hover:bg-indigo-50/30`}
                  >
                    <td className="px-3 py-3 text-center text-xs text-gray-400 font-mono border-r border-gray-100">{idx + 1}</td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="text"
                        readOnly={!canEdit}
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                        placeholder="アイテム名..."
                        className={`w-full px-4 py-3 bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-medium text-gray-800 read-only:cursor-default ${item.prepared ? 'line-through text-gray-400' : ''}`}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="number"
                        readOnly={!canEdit}
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-3 bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-center read-only:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <div className="flex items-center justify-end px-3 py-3 gap-1">
                        <span className="text-xs text-gray-400">¥</span>
                        <input
                          type="number"
                          readOnly={!canEdit}
                          value={item.unitPrice || ''}
                          onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                          className="w-full bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-right read-only:cursor-default"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-indigo-600 text-sm border-r border-gray-100 bg-indigo-50/30">
                      ¥{(item.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <div className="flex items-center justify-end px-3 py-3 gap-1">
                        <input
                          type="number"
                          readOnly={!canEdit}
                          value={item.shippingFee || ''}
                          onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-right read-only:cursor-default"
                        />
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-center border-r border-gray-100 transition-colors ${item.arrived ? 'bg-emerald-50/80' : ''}`}>
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox checked={item.arrived} disabled={!canEdit} onChange={() => updateItem(item.id, { arrived: !item.arrived })} color="emerald" />
                        {item.arrived && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">済</span>}
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-center border-r border-gray-100 transition-colors ${item.prepared ? 'bg-indigo-50/80' : ''}`}>
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
                        {item.prepared && <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">済</span>}
                      </div>
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <PreparationNoteField
                        value={item.note || ''}
                        readOnly={!canEdit}
                        onChange={note => updateItem(item.id, { note })}
                        desktop
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      {canEdit ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={item.url || ''}
                            onChange={e => updateItem(item.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="flex-1 px-2 py-1.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm text-indigo-500 min-w-0"
                          />
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-indigo-400 hover:text-indigo-600 p-1">
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      ) : item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-3 text-sm text-indigo-500 hover:text-indigo-700 underline underline-offset-2 break-all"
                        >
                          {item.url}
                          <ExternalLink size={12} className="shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <span className="px-4 py-3 block text-sm text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {canEdit && items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={addItem}
              className="w-full py-4 bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
            >
              <Plus size={14} /> 新しい項目を追加
            </button>
          )}
        </div>
        )}
      </div>

      {/* Footer - clean summary */}
      <div className="px-5 py-5 border-t border-[var(--separator)] shrink-0">
        {hasChanges && canEdit && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full mb-4 flex items-center justify-center gap-2 h-12 bg-[#007AFF] text-white rounded-2xl text-body font-medium active:opacity-80 transition-opacity disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? '保存中...' : '変更を保存'}
          </button>
        )}
        
        {/* Stats grid - asymmetric, intentional */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[var(--surface-tertiary)] rounded-xl p-3">
            <div className="text-caption2 text-[var(--text-tertiary)] mb-0.5">商品計</div>
            <div className="text-headline text-[var(--text-primary)] tabular-nums">¥{totals.subtotal.toLocaleString()}</div>
          </div>
          <div className="bg-[var(--surface-tertiary)] rounded-xl p-3">
            <div className="text-caption2 text-[var(--text-tertiary)] mb-0.5">配送料</div>
            <div className="text-headline text-[var(--text-primary)] tabular-nums">¥{totals.shipping.toLocaleString()}</div>
          </div>
          <div className="bg-[#007AFF] rounded-xl p-3">
            <div className="text-caption2 text-white/70 mb-0.5">合計</div>
            <div className="text-headline text-white tabular-nums">¥{totals.total.toLocaleString()}</div>
          </div>
          <div className="bg-[var(--surface-tertiary)] rounded-xl p-3">
            <div className="text-caption2 text-[var(--text-tertiary)] mb-1">進捗</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--separator)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${items.length > 0 ? (totals.done / items.length) * 100 : 0}%` }}
                  className="bg-[#34C759] h-full rounded-full"
                />
              </div>
              <span className="text-caption1 font-medium text-[#34C759] tabular-nums">
                {items.length > 0 ? Math.round((totals.done / items.length) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreparationNoteField({ value, onChange, readOnly, desktop }: { value: string; onChange: (note: string) => void; readOnly?: boolean; desktop?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={desktop ? 2 : 1}
      readOnly={readOnly}
      value={value}
      onChange={e => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
        onChange(e.target.value);
      }}
      placeholder="..."
      className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm text-gray-600 break-words read-only:cursor-default"
      style={{ resize: 'none', overflowX: 'hidden', minHeight: desktop ? '52px' : '38px' }}
    />
  );
}

function Checkbox({ checked, onChange, disabled, color = 'indigo' }: { checked: boolean; onChange: () => void; disabled?: boolean; color?: 'indigo' | 'emerald' }) {
  const activeColor = color === 'emerald' ? '#34C759' : '#007AFF';
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-6 h-6 rounded-md flex items-center justify-center transition-all active:scale-90 ${
        checked ? '' : 'bg-[var(--surface-tertiary)] border-2 border-[var(--separator)]'
      } disabled:opacity-40 disabled:pointer-events-none`}
      style={checked ? { backgroundColor: activeColor } : undefined}
    >
      {checked && (
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
