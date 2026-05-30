import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Pencil, Trash2, ExternalLink, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface MasterItem {
  id: string;
  name: string;
  unitPrice: number;
  defaultQuantity: number;
  note: string;
  url?: string;
}

interface Props {
  canEdit: boolean;
}

const EMPTY_FORM = { name: '', unitPrice: '', defaultQuantity: '1', note: '', url: '' };

// 倉庫の背景画像（Unsplash）
const WAREHOUSE_BG = "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80";

export default function MasterItemsView({ canEdit }: Props) {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'masterItems'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as MasterItem[];
      list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setItems(list);
    });
    return () => unsub();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(item: MasterItem) {
    setEditing(item);
    setForm({
      name: item.name,
      unitPrice: String(item.unitPrice),
      defaultQuantity: String(item.defaultQuantity),
      note: item.note ?? '',
      url: item.url ?? '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    const trimmed = form.name.trim();
    if (!trimmed) return;
    const data = {
      name: trimmed,
      unitPrice: parseInt(form.unitPrice) || 0,
      defaultQuantity: parseInt(form.defaultQuantity) || 1,
      note: form.note.trim(),
      url: form.url.trim(),
      updatedAt: serverTimestamp(),
    };
    try {
      if (editing) {
        await updateDoc(doc(db, 'masterItems', editing.id), data);
      } else {
        await addDoc(collection(db, 'masterItems'), data);
      }
      setShowForm(false);
    } catch (err) {
      console.error('masterItems save error:', err);
      alert('保存に失敗しました。権限またはネットワークを確認してください。');
    }
  }

  async function handleDelete(item: MasterItem) {
    if (!confirm(`「${item.name}」を削除しますか？`)) return;
    await deleteDoc(doc(db, 'masterItems', item.id));
  }

  return (
    <div className="relative flex flex-col min-h-full">
      {/* 倉庫背景 */}
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${WAREHOUSE_BG}')` }} />
      {/* グラデーションオーバーレイ（上部は写真を活かし、下部にかけて濃く） */}
      <div
        className="fixed inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(15,23,42,0.30) 0%, rgba(15,23,42,0.52) 45%, rgba(15,23,42,0.72) 100%)" }}
      />

      {/* Sticky header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0">
        <div>
          <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">MASTER</div>
          <h2 className="text-base font-black text-white">備品マスター</h2>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-colors shadow-indigo-200 shadow-md"
          >
            <Plus size={14} strokeWidth={3} />
            追加
          </button>
        )}
      </div>

      {/* List */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 pb-24">
        {items.length === 0 ? (
          <div className="text-center py-16 text-white/60">
            <Package size={32} className="mx-auto mb-3 opacity-50" />
            <div className="text-sm">マスターアイテムがありません</div>
            {canEdit && <div className="text-xs mt-1 opacity-70">「追加」から登録してください</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
            {items.map(item => (
              <motion.div
                key={item.id}
                layout
                className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl p-4 hover:bg-white transition-colors group shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-black text-sm text-slate-800 leading-snug">{item.name}</div>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-1">
                  ¥{item.unitPrice.toLocaleString()} · デフォルト {item.defaultQuantity}個
                </div>
                {item.note && <div className="text-xs text-slate-400 mb-1">{item.note}</div>}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] text-indigo-500 flex items-center gap-0.5 hover:underline mt-1"
                  >
                    <ExternalLink size={10} />
                    リンクを開く
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full sm:max-w-md bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 z-10"
            >
              <h3 className="text-base font-black text-[var(--text-primary)] mb-4">
                {editing ? 'アイテムを編集' : '新しいアイテムを追加'}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">品名 *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-transparent text-sm outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    placeholder="テーブルクロス"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">単価（¥）</label>
                    <input
                      type="number"
                      value={form.unitPrice}
                      onChange={e => setForm(v => ({ ...v, unitPrice: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-transparent text-sm outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">デフォルト数量</label>
                    <input
                      type="number"
                      value={form.defaultQuantity}
                      onChange={e => setForm(v => ({ ...v, defaultQuantity: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-transparent text-sm outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                      placeholder="1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">メモ</label>
                  <input
                    value={form.note}
                    onChange={e => setForm(v => ({ ...v, note: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-transparent text-sm outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    placeholder="サイズ・色など"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">リンク URL</label>
                  <input
                    value={form.url}
                    onChange={e => setForm(v => ({ ...v, url: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-transparent text-sm outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-bold text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black transition-colors disabled:opacity-50"
                >
                  {editing ? '更新' : '追加'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
