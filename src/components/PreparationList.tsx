import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { PreparationItem, Event } from '../types';
import { Trash2, Plus, ArrowLeft, Save, ExternalLink } from 'lucide-react';
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
    return { subtotal, shipping, total: subtotal + shipping, prepared: items.filter(i => i.prepared).length };
  }, [items]);


  return (
    <div className="flex flex-col h-full bg-gray-50">
      {!canEdit && (
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 text-slate-600 text-[11px] font-bold text-center">
          閲覧のみ（準備物の編集にはログインが必要です）
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          onClick={() => setSaveError(null)}
          className="px-6 py-3 bg-red-50 border-b border-red-100 text-red-700 text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <span>⚠️</span>
          <span className="flex-1">{saveError}</span>
          <span className="text-[10px] opacity-60">タップで閉じる</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-black text-gray-900 leading-tight">{event.venue}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-400 font-mono">{event.start} → {event.end}</span>
              <span className="text-gray-300">·</span>
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">PREPARATION LIST</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && canEdit && (
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              <Save size={13} />
              {isSaving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="block lg:hidden flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden ${item.prepared ? 'opacity-70' : ''}`}
          >
            {/* Row 1: # + 品名 + delete */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <span className="text-[10px] text-gray-400 font-mono w-5 shrink-0">{idx + 1}</span>
              <input
                type="text"
                readOnly={!canEdit}
                value={item.name}
                onChange={e => updateItem(item.id, { name: e.target.value })}
                placeholder="アイテム名..."
                className={`flex-1 text-sm font-bold text-gray-800 bg-transparent outline-none read-only:cursor-default ${item.prepared ? 'line-through text-gray-400' : ''}`}
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1 || !canEdit}
                className={`p-1 shrink-0 transition-colors ${
                  items.length <= 1 ? 'opacity-0 pointer-events-none' : !canEdit ? 'opacity-30 cursor-not-allowed' : 'text-gray-300 hover:text-red-400'
                }`}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {/* Row 2: 数量 / 単価 / 金額 */}
            <div className="grid grid-cols-3 border-t border-gray-100">
              <div className="px-3 py-2 border-r border-gray-100">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">数量</div>
                <input
                  type="number"
                  readOnly={!canEdit}
                  value={item.quantity || ''}
                  onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm font-mono text-gray-700 bg-transparent outline-none read-only:cursor-default"
                />
              </div>
              <div className="px-3 py-2 border-r border-gray-100">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">単価</div>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-400">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.unitPrice || ''}
                    onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm font-mono text-gray-700 bg-transparent outline-none read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="px-3 py-2 bg-indigo-50/30">
                <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">金額</div>
                <div className="text-sm font-black text-indigo-600 font-mono">¥{(item.amount || 0).toLocaleString()}</div>
              </div>
            </div>
            {/* Row 3: 配送料 / 到着 / 準備 */}
            <div className="grid grid-cols-3 border-t border-gray-100">
              <div className="px-3 py-2 border-r border-gray-100">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">配送料</div>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-400">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.shippingFee || ''}
                    onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-sm font-mono text-gray-700 bg-transparent outline-none read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="px-3 py-2 flex flex-col items-center border-r border-gray-100">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">到着</div>
                <Checkbox checked={item.arrived} disabled={!canEdit} onChange={() => updateItem(item.id, { arrived: !item.arrived })} />
              </div>
              <div className="px-3 py-2 flex flex-col items-center">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">準備</div>
                <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
              </div>
            </div>
            {/* Row 4: 備考 (shown if has content or canEdit) */}
            {(item.note || canEdit) && (
              <div className="border-t border-gray-100 px-3 py-2">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">備考</div>
                <PreparationNoteField value={item.note || ''} readOnly={!canEdit} onChange={note => updateItem(item.id, { note })} />
              </div>
            )}
            {/* Row 5: URL (shown if has content or canEdit) */}
            {(item.url || canEdit) && (
              <div className="border-t border-gray-100 px-3 py-2">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">URL</div>
                {canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.url || ''}
                      onChange={e => updateItem(item.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 text-sm text-indigo-500 bg-transparent outline-none min-w-0"
                    />
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-indigo-400 hover:text-indigo-600">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-500 underline underline-offset-2 break-all"
                  >
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
            className="w-full py-4 bg-white border-2 border-dashed border-gray-200 hover:border-indigo-300 text-gray-400 hover:text-indigo-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} /> 新しい項目を追加
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block flex-1 overflow-auto p-6">
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
                  <th className="w-16 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center border-r border-gray-100">到着</th>
                  <th className="w-16 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center border-r border-gray-100">準備</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '120px' }}>備考</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '160px' }}>URL</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`group transition-colors ${item.prepared ? 'bg-gray-50/60' : 'bg-white'} hover:bg-indigo-50/20`}
                  >
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 font-mono border-r border-gray-100">{idx + 1}</td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="text"
                        readOnly={!canEdit}
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                        placeholder="アイテム名..."
                        className={`w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-medium text-gray-800 read-only:cursor-default ${item.prepared ? 'line-through text-gray-400' : ''}`}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="number"
                        readOnly={!canEdit}
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-center read-only:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <div className="flex items-center justify-end px-3 py-2.5 gap-1">
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
                    <td className="px-3 py-2.5 text-right font-mono font-black text-indigo-600 text-sm border-r border-gray-100 bg-indigo-50/30">
                      ¥{(item.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <div className="flex items-center justify-end px-3 py-2.5 gap-1">
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
                    <td className="px-3 py-2.5 text-center border-r border-gray-100">
                      <Checkbox checked={item.arrived} disabled={!canEdit} onChange={() => updateItem(item.id, { arrived: !item.arrived })} />
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-gray-100">
                      <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <PreparationNoteField
                        value={item.note || ''}
                        readOnly={!canEdit}
                        onChange={note => updateItem(item.id, { note })}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      {canEdit ? (
                        <input
                          type="text"
                          value={item.url || ''}
                          onChange={e => updateItem(item.id, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm text-indigo-500"
                        />
                      ) : item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-indigo-500 hover:text-indigo-700 underline underline-offset-2 break-all"
                        >
                          {item.url}
                          <ExternalLink size={12} className="shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <span className="px-4 py-2.5 block text-sm text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1 || !canEdit}
                        className={`p-1 text-gray-200 transition-colors ${
                          items.length <= 1
                            ? 'opacity-0 pointer-events-none'
                            : !canEdit
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:text-red-400'
                        }`}
                      >
                        <Trash2 size={13} />
                      </button>
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
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-100 shrink-0">
        {hasChanges && canEdit && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full mb-3 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm transition-colors disabled:opacity-60"
          >
            <Save size={16} />
            {isSaving ? '保存中...' : '変更を保存'}
          </button>
        )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">SUBTOTAL · 商品計</div>
          <div className="text-xl font-black text-gray-900 font-mono">¥{totals.subtotal.toLocaleString()}</div>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">SHIPPING · 配送料</div>
          <div className="text-xl font-black text-gray-900 font-mono">¥{totals.shipping.toLocaleString()}</div>
        </div>
        <div className="bg-indigo-600 rounded-2xl p-4">
          <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">TOTAL · 総支払</div>
          <div className="text-xl font-black text-white font-mono">¥{totals.total.toLocaleString()}</div>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">PROGRESS · 進捗</div>
            <div className="text-xs font-black text-indigo-600">
              {items.length > 0 ? Math.round((totals.prepared / items.length) * 100) : 0}%
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${items.length > 0 ? (totals.prepared / items.length) * 100 : 0}%` }}
              className="bg-indigo-600 h-1.5 rounded-full"
            />
          </div>
          <div className="text-[10px] text-gray-400 font-bold">{totals.prepared} / {items.length} done</div>
        </div>
      </div>
      </div>
    </div>
  );
}

function PreparationNoteField({ value, onChange, readOnly }: { value: string; onChange: (note: string) => void; readOnly?: boolean }) {
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
      rows={1}
      readOnly={readOnly}
      value={value}
      onChange={e => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
        onChange(e.target.value);
      }}
      placeholder="..."
      className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm text-gray-600 break-words read-only:cursor-default"
      style={{ resize: 'none', overflowX: 'hidden', minHeight: '38px' }}
    />
  );
}

function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all ${
        checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'
      } disabled:opacity-40 disabled:pointer-events-none disabled:hover:border-gray-300`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
