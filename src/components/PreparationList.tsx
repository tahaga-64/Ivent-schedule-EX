import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { PreparationItem, Event } from '../types';
import { Trash2, Plus, ArrowLeft, CheckCircle2, PackageCheck } from 'lucide-react';

interface Props {
  event: Event;
  onBack: () => void;
}

export default function PreparationList({ event, onBack }: Props) {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from Firestore
  useEffect(() => {
    const path = `events/${event.id}/preparationItems`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
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
  }, [event.id, loading]);

  const updateItem = async (id: string, updates: Partial<PreparationItem>) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newItem = { ...item, ...updates };
    newItem.amount = (newItem.quantity || 0) * (newItem.unitPrice || 0);

    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? newItem : i));

    try {
      await setDoc(doc(db, `events/${event.id}/preparationItems`, id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/preparationItems/${id}`);
    }
  };

  const addItem = async () => {
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
    try {
      await setDoc(doc(db, `events/${event.id}/preparationItems`, newItem.id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/preparationItems/${newItem.id}`);
    }
  };

  const removeItem = async (id: string) => {
    if (items.length <= 1) return;
    try {
      await deleteDoc(doc(db, `events/${event.id}/preparationItems`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${event.id}/preparationItems/${id}`);
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
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors text-slate-500 dark:text-zinc-400 border border-slate-100 dark:border-zinc-800">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100 leading-tight">{event.venue}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-mono">{event.start} 〜 {event.end}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span className="text-[10px] font-bold text-purple-accent">準備物リスト</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="min-w-[1000px] border border-slate-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-xl bg-white dark:bg-zinc-900 transition-colors">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 transition-colors">
                <th className="w-12 p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">#</th>
                <th className="p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase text-left">品名</th>
                <th className="w-24 p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">数量</th>
                <th className="w-32 p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">単価(円)</th>
                <th className="w-32 p-4 border-r border-slate-200 dark:border-zinc-800 text-purple-accent font-black text-[10px] uppercase bg-purple-50 dark:bg-purple-900/10">金額(円)</th>
                <th className="w-32 p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">配送料(円)</th>
                <th className="w-28 p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">到着</th>
                <th className="w-28 p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">準備</th>
                <th className="p-4 border-r border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase text-left">備考</th>
                <th className="w-16 p-4 text-slate-400 dark:text-zinc-600 font-black text-[10px] uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {items.map((item, idx) => (
                <tr 
                  key={item.id} 
                  className={`
                    transition-colors group
                    ${item.prepared ? 'bg-emerald-500/10 dark:bg-emerald-500/5' : ''}
                    hover:bg-slate-50 dark:hover:bg-zinc-800/50
                  `}
                >
                  <td className="p-4 border-r border-slate-200 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-600 font-mono text-[10px] font-black">{idx + 1}</td>
                  <td className="p-0 border-r border-slate-200 dark:border-zinc-800">
                    <input 
                      type="text" 
                      value={item.name} 
                      onChange={e => updateItem(item.id, { name: e.target.value })}
                      placeholder="アイテム名..."
                      className="w-full p-4 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent text-slate-800 dark:text-zinc-100 font-bold"
                    />
                  </td>
                  <td className="p-0 border-r border-slate-200 dark:border-zinc-800">
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent text-center font-mono font-bold text-slate-800 dark:text-zinc-100"
                    />
                  </td>
                  <td className="p-0 border-r border-slate-200 dark:border-zinc-800">
                    <input 
                      type="number" 
                      value={item.unitPrice} 
                      onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent text-right font-mono font-bold text-slate-800 dark:text-zinc-100"
                    />
                  </td>
                  <td className="p-4 border-r border-slate-200 dark:border-zinc-800 text-right font-mono font-black bg-purple-50/30 dark:bg-purple-900/5 text-purple-accent">
                    ¥{Math.floor(item.amount || 0).toLocaleString()}
                  </td>
                  <td className="p-0 border-r border-slate-200 dark:border-zinc-800">
                    <input 
                      type="number" 
                      value={item.shippingFee} 
                      onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent text-right font-mono font-bold text-slate-800 dark:text-zinc-100"
                    />
                  </td>
                  <td className="p-4 border-r border-slate-200 dark:border-zinc-800 text-center">
                    <button 
                      onClick={() => updateItem(item.id, { arrived: !item.arrived })}
                      className={`
                        w-8 h-8 rounded-xl border flex items-center justify-center mx-auto transition-all scale-90 group-hover:scale-100
                        ${item.arrived 
                          ? 'bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/30' 
                          : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-transparent hover:border-blue-300'}
                      `}
                    >
                      <PackageCheck size={16} />
                    </button>
                  </td>
                  <td className="p-4 border-r border-slate-200 dark:border-zinc-800 text-center">
                    <button 
                      onClick={() => updateItem(item.id, { prepared: !item.prepared })}
                      className={`
                        w-8 h-8 rounded-xl border flex items-center justify-center mx-auto transition-all scale-90 group-hover:scale-110
                        ${item.prepared 
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/30' 
                          : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-transparent hover:border-emerald-300'}
                      `}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  </td>
                  <td className="p-0 border-r border-slate-200 dark:border-zinc-800">
                    <input 
                      type="text" 
                      value={item.note || ''} 
                      onChange={e => updateItem(item.id, { note: e.target.value })}
                      placeholder="..."
                      className="w-full p-4 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent text-slate-800 dark:text-zinc-100"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-0"
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
            className="w-full p-6 bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-3"
          >
            <Plus size={16} /> 行を追加
          </button>
        </div>
      </div>

      {/* Footer Summary */}
      <div className="p-8 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-900 grid grid-cols-1 md:grid-cols-4 gap-6 transition-colors">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] shadow-sm border border-slate-200 dark:border-zinc-800 transition-colors">
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-2">商品計</div>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-zinc-100">¥{totals.subtotal.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] shadow-sm border border-slate-200 dark:border-zinc-800 transition-colors">
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest mb-2">配送料合計</div>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-zinc-100">¥{totals.shipping.toLocaleString()}</div>
        </div>
        <div className="bg-purple-accent p-6 rounded-[1.5rem] shadow-[0_10px_40px_rgba(168,85,247,0.3)] border border-purple-600 col-span-1">
          <div className="text-[10px] text-purple-100 font-bold uppercase tracking-widest mb-2">総支払額</div>
          <div className="text-3xl font-black font-mono text-white">¥{totals.total.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col justify-center transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">進捗率</span>
            <span className="text-sm font-black text-emerald-500">{Math.round((totals.preparedCount / items.length) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-400 to-teal-600 h-full transition-all duration-700 shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
              style={{ width: `${(totals.preparedCount / items.length) * 100}%` }}
            ></div>
          </div>
          <div className="text-right mt-2 text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">{totals.preparedCount} / {items.length} Items Done</div>
        </div>
      </div>
    </div>
  );
}
