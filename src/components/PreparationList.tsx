import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { PreparationItem, Event } from '../types';
import { Trash2, Plus, ArrowLeft, Save, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  event: Event;
  onBack: () => void;
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

export default function PreparationList({ event, onBack }: Props) {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const path = `events/${event.id}/preparationItems`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      if (hasChanges) return;
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PreparationItem));
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      if (data.length === 0 && loading) {
        setItems(Array.from({ length: 5 }, (_, i) => ({
          id: crypto.randomUUID(),
          name: '', quantity: 1, unitPrice: 0, amount: 0,
          shippingFee: 0, arrived: false, prepared: false, note: '', url: '', order: i,
        })));
      } else {
        setItems(data);
      }
      setLoading(false);
    }, (error) => {
      console.error('PreparationList load error:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [event.id, hasChanges]);

  const handleSaveAll = async () => {
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
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newItem = { ...item, ...updates };
    newItem.amount = (newItem.quantity || 0) * (newItem.unitPrice || 0);
    setItems(prev => prev.map(i => i.id === id ? newItem : i));
    setHasChanges(true);
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0,
      amount: 0, shippingFee: 0, arrived: false, prepared: false,
      note: '', url: '', order: prev.length,
    }]);
    setHasChanges(true);
  };

  const removeItem = async (id: string) => {
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

  const handleExportCSV = () => {
    const headers = ['#', '品名', '数量', '単価', '金額', '配送料', '到着', '準備', '備考', 'URL'];
    const rows = items.map((item, i) => [
      i + 1, `"${item.name}"`, item.quantity, item.unitPrice, item.amount,
      item.shippingFee, item.arrived ? '✓' : '', item.prepared ? '✓' : '',
      `"${item.note || ''}"`, `"${item.url || ''}"`,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.venue}_準備物.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
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
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              <Save size={13} />
              {isSaving ? '保存中...' : '保存'}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            <span className="hidden sm:inline">CSV エクスポート</span>
          </button>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">行を追加</span>
            <span className="sm:hidden">追加</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
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
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '160px' }}>URL</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '120px' }}>備考</th>
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
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                        placeholder="アイテム名..."
                        className={`w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-medium text-gray-800 ${item.prepared ? 'line-through text-gray-400' : ''}`}
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-center"
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <div className="flex items-center justify-end px-3 py-2.5 gap-1">
                        <span className="text-xs text-gray-400">¥</span>
                        <input
                          type="number"
                          value={item.unitPrice || ''}
                          onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                          className="w-full bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-right"
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
                          value={item.shippingFee || ''}
                          onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full bg-transparent outline-none focus:bg-indigo-50/30 text-sm font-mono text-gray-700 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-gray-100">
                      <Checkbox checked={item.arrived} onChange={() => updateItem(item.id, { arrived: !item.arrived })} />
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-gray-100">
                      <Checkbox checked={item.prepared} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <input
                        type="text"
                        value={item.url || ''}
                        onChange={e => updateItem(item.id, { url: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm text-indigo-500"
                      />
                    </td>
                    <td className="p-0 border-r border-gray-100">
                      <PreparationNoteField
                        value={item.note || ''}
                        onChange={note => updateItem(item.id, { note })}
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
                        className="p-1 text-gray-200 hover:text-red-400 transition-colors disabled:opacity-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addItem}
            className="w-full py-4 bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
          >
            <Plus size={14} /> 新しい項目を追加
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
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
  );
}

function PreparationNoteField({ value, onChange }: { value: string; onChange: (note: string) => void }) {
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
      value={value}
      onChange={e => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
        onChange(e.target.value);
      }}
      placeholder="..."
      className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-indigo-50/30 text-sm text-gray-600 break-words"
      style={{ resize: 'none', overflowX: 'hidden', minHeight: '38px' }}
    />
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all ${
        checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
