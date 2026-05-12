import { useState, useEffect, useMemo, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { PreparationItem, Event } from '../types';
import { Trash2, Plus, ArrowLeft, CheckCircle2, PackageCheck, Loader2, Save } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  event: Event;
  onBack: () => void;
}

export default function PreparationList({ event, onBack }: Props) {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load from Firestore
  useEffect(() => {
    const path = `events/${event.id}/preparationItems`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      // 変更がある場合はリモートデータでの上書きを防ぐ
      if (hasChanges) return;

      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PreparationItem));
      // Sort by order or id if no order
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // If empty, initialize with 5 rows
      if (data.length === 0 && loading) {
        const initialItems: PreparationItem[] = Array.from({ length: 5 }).map((_, i) => ({
          id: crypto.randomUUID(),
          name: '',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          shippingFee: 0,
          arrived: false,
          prepared: false,
          note: '',
          order: i
        }));
        setItems(initialItems);
      } else {
        setItems(data);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [event.id, hasChanges]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // 既存のアイテムをすべて保存
      const promises = items.map(item => 
        setDoc(doc(db, `events/${event.id}/preparationItems`, item.id), item)
      );
      await Promise.all(promises);
      setHasChanges(false);
      setTimeout(() => setIsSaving(false), 800);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/preparationItems`);
      setIsSaving(false);
    }
  };

  const updateItem = (id: string, updates: Partial<PreparationItem>) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newItem = { ...item, ...updates };
    newItem.amount = (newItem.quantity || 0) * (newItem.unitPrice || 0);

    // 1. UIを更新
    setItems(prev => prev.map(i => i.id === id ? newItem : i));
    // 2. 変更フラグを立てる
    setHasChanges(true);
  };

  const addItem = () => {
    const newItem: PreparationItem = {
      id: crypto.randomUUID(),
      name: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      shippingFee: 0,
      arrived: false,
      prepared: false,
      note: '',
      order: items.length
    };
    setItems(prev => [...prev, newItem]);
    setHasChanges(true);
  };

  const removeItem = async (id: string) => {
    if (items.length <= 1) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, `events/${event.id}/preparationItems`, id));
      setItems(prev => prev.filter(i => i.id !== id));
      setTimeout(() => setIsSaving(false), 600);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${event.id}/preparationItems/${id}`);
      setIsSaving(false);
    }
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const shipping = items.reduce((sum, item) => sum + (item.shippingFee || 0), 0);
    const total = subtotal + shipping;
    const preparedCount = items.filter(i => i.prepared).length;
    return { subtotal, shipping, total, preparedCount };
  }, [items]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b border-[var(--border)] bg-[var(--surface)]/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-8">
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: "var(--surface-raised)" }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack} 
            className="w-12 h-12 flex items-center justify-center rounded-2xl transition-all text-[var(--text-secondary)] border border-[var(--border)] shadow-sm"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] leading-tight tracking-tight">{event.venue}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-60 font-mono">{event.start} 〜 {event.end}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/40"></span>
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">準備物リスト</span>
              <AnimatePresence>
                {isSaving && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]"
                  >
                    <Loader2 size={10} className="animate-spin" />
                    {hasChanges ? "Saving to Cloud..." : "Synced"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {hasChanges && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleSaveAll}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Save size={16} />
                変更をクラウドに保存
              </motion.button>
            )}
          </AnimatePresence>
          <div className="hidden sm:flex flex-col items-end px-4 border-l border-[var(--border)]">
            <span className="text-[10px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">ステータス</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${hasChanges ? "text-amber-500" : "text-emerald-500"}`}>
              {hasChanges ? "未保存の変更" : "同期済み"}
            </span>
          </div>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto p-4 sm:p-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-[1400px] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-2xl bg-[var(--surface)] transition-all"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border)] transition-colors">
                <th className="w-14 p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-40 font-black text-[10px] uppercase tracking-widest">#</th>
                <th className="w-[400px] p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest text-left">品名</th>
                <th className="w-28 p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest">数量</th>
                <th className="w-36 p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest">単価(円)</th>
                <th className="w-40 p-5 border-r border-[var(--border)] text-amber-500 font-black text-[10px] uppercase tracking-widest bg-amber-500/5">金額(円)</th>
                <th className="w-36 p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest">配送料(円)</th>
                <th className="w-32 p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest">到着</th>
                <th className="w-32 p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest">準備</th>
                <th className="p-5 border-r border-[var(--border)] text-[var(--text-secondary)] opacity-60 font-black text-[10px] uppercase tracking-widest text-left">備考</th>
                <th className="w-20 p-5 text-[var(--text-secondary)] opacity-40 font-black text-[10px] uppercase tracking-widest">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((item, idx) => (
                <tr 
                  key={item.id} 
                  className={`
                    transition-all group
                    ${item.prepared ? 'bg-emerald-500/[0.03]' : ''}
                    hover:bg-purple-accent/[0.01]
                  `}
                >
                  <td className="p-5 border-r border-[var(--border)] text-center text-[var(--text-secondary)] opacity-40 font-mono text-[10px] font-black">{idx + 1}</td>
                  <td className="p-0 border-r border-[var(--border)]">
                    <input 
                      type="text" 
                      value={item.name} 
                      onChange={e => updateItem(item.id, { name: e.target.value })}
                      placeholder="アイテム名..."
                      className="w-full p-5 bg-transparent outline-none focus:bg-[var(--surface-raised)] text-[var(--text-primary)] font-bold transition-all"
                    />
                  </td>
                  <td className="p-0 border-r border-[var(--border)]">
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                      className="w-full p-5 bg-transparent outline-none focus:bg-[var(--surface-raised)] text-center font-mono font-bold text-[var(--text-primary)] transition-all"
                    />
                  </td>
                  <td className="p-0 border-r border-[var(--border)]">
                    <input 
                      type="number" 
                      value={item.unitPrice} 
                      onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                      className="w-full p-5 bg-transparent outline-none focus:bg-[var(--surface-raised)] text-right font-mono font-bold text-[var(--text-primary)] transition-all"
                    />
                  </td>
                  <td className="p-5 border-r border-[var(--border)] text-right font-mono font-black bg-purple-500/[0.02] text-purple-accent">
                    ¥{Math.floor(item.amount || 0).toLocaleString()}
                  </td>
                  <td className="p-0 border-r border-[var(--border)]">
                    <input 
                      type="number" 
                      value={item.shippingFee} 
                      onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                      className="w-full p-5 bg-transparent outline-none focus:bg-[var(--surface-raised)] text-right font-mono font-bold text-[var(--text-primary)] transition-all"
                    />
                  </td>
                  <td className="p-5 border-r border-[var(--border)] text-center">
                    <button 
                      onClick={() => updateItem(item.id, { arrived: !item.arrived })}
                      className={`
                        w-9 h-9 rounded-xl border flex items-center justify-center mx-auto transition-all transform
                        ${item.arrived 
                          ? 'bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/20 scale-110' 
                          : 'bg-[var(--surface-raised)] border-[var(--border)] text-transparent hover:border-blue-500/50 hover:scale-105'}
                      `}
                    >
                      <PackageCheck size={18} />
                    </button>
                  </td>
                  <td className="p-5 border-r border-[var(--border)] text-center">
                    <button 
                      onClick={() => updateItem(item.id, { prepared: !item.prepared })}
                      className={`
                        w-9 h-9 rounded-xl border flex items-center justify-center mx-auto transition-all transform
                        ${item.prepared 
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-110' 
                          : 'bg-[var(--surface-raised)] border-[var(--border)] text-transparent hover:border-emerald-500/50 hover:scale-105'}
                      `}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </td>
                  <td className="p-0 border-r border-[var(--border)]">
                    <input 
                      type="text" 
                      value={item.note || ''} 
                      onChange={e => updateItem(item.id, { note: e.target.value })}
                      placeholder="..."
                      className="w-full p-5 bg-transparent outline-none focus:bg-[var(--surface-raised)] text-[var(--text-primary)] transition-all"
                    />
                  </td>
                  <td className="p-5 text-center">
                    <button 
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1}
                      className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] opacity-20 hover:opacity-100 hover:text-red-500 transition-all disabled:opacity-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button 
            onClick={addItem}
            className="w-full p-8 bg-[var(--bg-app)] hover:bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" /> 
            新しい項目を追加する
          </button>
        </motion.div>
      </div>

      {/* Footer Summary */}
      <div className="p-10 bg-[var(--surface)]/50 backdrop-blur-md border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-4 gap-8 transition-colors">
        <div className="bg-[var(--surface)] p-8 rounded-[2rem] shadow-sm border border-[var(--border)] transition-colors relative overflow-hidden group">
          <div className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-3 opacity-60">商品小計</div>
          <div className="text-3xl font-black font-mono text-[var(--text-primary)] tracking-tight">¥{totals.subtotal.toLocaleString()}</div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-amber-500/10 transition-all"></div>
        </div>
        <div className="bg-[var(--surface)] p-8 rounded-[2rem] shadow-sm border border-[var(--border)] transition-colors relative overflow-hidden group">
          <div className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-3 opacity-60">配送料</div>
          <div className="text-3xl font-black font-mono text-[var(--text-primary)] tracking-tight">¥{totals.shipping.toLocaleString()}</div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-blue-500/10 transition-all"></div>
        </div>
        <div className="bg-amber-500 p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(245,158,11,0.2)] border border-amber-600 col-span-1 relative overflow-hidden group">
          <div className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em] mb-3">総支払額 (税込)</div>
          <div className="text-4xl font-black font-mono text-white tracking-tighter">¥{totals.total.toLocaleString()}</div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all"></div>
        </div>
        <div className="bg-[var(--surface)] p-8 rounded-[2rem] shadow-sm border border-[var(--border)] flex flex-col justify-center transition-colors relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] opacity-60">進捗状況</span>
            <span className="text-sm font-black text-emerald-500">{Math.round((totals.preparedCount / items.length) * 100)}%</span>
          </div>
          <div className="w-full bg-[var(--bg-app)] h-4 rounded-full overflow-hidden border border-[var(--border)]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(totals.preparedCount / (items.length || 1)) * 100}%` }}
              className="bg-gradient-to-r from-amber-400 to-orange-600 h-full shadow-[0_0_20px_rgba(245,158,11,0.3)]" 
            />
          </div>
          <div className="text-right mt-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">{totals.preparedCount} / {items.length} COMPLETED</div>
        </div>
      </div>
    </div>
  );
}
