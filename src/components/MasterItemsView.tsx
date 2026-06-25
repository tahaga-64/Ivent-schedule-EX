import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Pencil, Trash2, ExternalLink, Package, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAutoKana } from '../hooks/useAutoKana';

// ── 検索エンジン ──────────────────────────────────────────────────────────────

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function getTokens(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

function scoreItem(item: MasterItem, tokens: string[]): number {
  if (!tokens.length) return 1;
  const name = normalizeForSearch(item.name);
  const yomi = normalizeForSearch(item.yomi ?? '');
  const note = normalizeForSearch(item.note ?? '');
  let score = 0;
  for (const token of tokens) {
    const ni = name.indexOf(token);
    const yi = yomi.indexOf(token);
    const oi = note.indexOf(token);
    if (ni === -1 && yi === -1 && oi === -1) return -1;
    if (name === token) score += 20;
    else if (ni === 0) score += 12;
    else if (ni > -1) score += 6;
    if (yi > -1) score += 8;
    if (oi > -1) score += 3;
  }
  return score;
}

function highlight(text: string, tokens: string[]): ReactNode {
  if (!tokens.length || !text) return text;
  const normalized = normalizeForSearch(text);
  const regions: [number, number][] = [];
  for (const token of tokens) {
    let pos = 0, idx: number;
    while ((idx = normalized.indexOf(token, pos)) !== -1) {
      regions.push([idx, idx + token.length]);
      pos = idx + 1;
    }
  }
  if (!regions.length) return text;
  regions.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const parts: ReactNode[] = [];
  let cur = 0;
  for (const [s, e] of merged) {
    if (cur < s) parts.push(text.slice(cur, s));
    parts.push(<mark key={s} className="bg-yellow-200 text-yellow-900 rounded-[2px] not-italic">{text.slice(s, e)}</mark>);
    cur = e;
  }
  if (cur < text.length) parts.push(text.slice(cur));
  return <>{parts}</>;
}

export interface MasterItem {
  id: string;
  name: string;
  yomi?: string;
  unitPrice: number;
  defaultQuantity: number;
  note: string;
  url?: string;
}

interface Props {
  canEdit: boolean;
  isActive?: boolean;
}

const EMPTY_FORM = { name: '', yomi: '', unitPrice: '', defaultQuantity: '1', note: '', url: '' };

export default function MasterItemsView({ canEdit, isActive = true }: Props) {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { runWithGuard } = useUnsavedChanges();
  const autoKana = useAutoKana();

  // 品名のIME入力から取得した読みを yomi へ自動反映（手入力時は上書きしない）
  useEffect(() => {
    setForm(v => (v.yomi === autoKana.reading ? v : { ...v, yomi: autoKana.reading }));
  }, [autoKana.reading]);

  const isFormDirty = useMemo(() => {
    if (!showForm) return false;
    if (editing) {
      return (
        form.name.trim() !== editing.name ||
        form.yomi.trim() !== (editing.yomi ?? '') ||
        (parseInt(form.unitPrice) || 0) !== editing.unitPrice ||
        (parseInt(form.defaultQuantity) || 1) !== editing.defaultQuantity ||
        form.note.trim() !== (editing.note ?? '') ||
        form.url.trim() !== (editing.url ?? '')
      );
    }
    return !!(
      form.name.trim() ||
      form.yomi.trim() ||
      form.unitPrice ||
      form.note.trim() ||
      form.url.trim() ||
      (form.defaultQuantity && form.defaultQuantity !== '1')
    );
  }, [showForm, editing, form]);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    autoKana.reset();
  }, [autoKana.reset]);

  const tokens = useMemo(() => getTokens(query), [query]);

  const filteredItems = useMemo(() => {
    if (!tokens.length) return items;
    const scored = items
      .map(item => ({ item, score: scoreItem(item, tokens) }))
      .filter(({ score }) => score >= 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => item);
  }, [items, tokens]);

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const unsub = onSnapshot(collection(db, 'masterItems'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as MasterItem[];
      list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setItems(list);
    });
    return () => unsub();
  }, [isActive]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    autoKana.reset('');
    setShowForm(true);
  }

  function openEdit(item: MasterItem) {
    setEditing(item);
    setForm({
      name: item.name,
      yomi: item.yomi ?? '',
      unitPrice: String(item.unitPrice),
      defaultQuantity: String(item.defaultQuantity),
      note: item.note ?? '',
      url: item.url ?? '',
    });
    autoKana.reset(item.yomi ?? '');
    setShowForm(true);
  }

  const handleSave = useCallback(async (): Promise<boolean> => {
    const trimmed = form.name.trim();
    if (!trimmed) return false;
    const data = {
      name: trimmed,
      yomi: form.yomi.trim(),
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
      closeForm();
      return true;
    } catch (err) {
      console.error('masterItems save error:', err);
      alert('保存に失敗しました。権限またはネットワークを確認してください。');
      return false;
    }
  }, [form, editing, closeForm]);

  useRegisterUnsavedGuard('master-items-form', {
    enabled: canEdit && showForm,
    hasUnsaved: isFormDirty,
    save: handleSave,
    discard: closeForm,
  });

  async function handleDelete(item: MasterItem) {
    if (!confirm(`「${item.name}」を削除しますか？`)) return;
    await deleteDoc(doc(db, 'masterItems', item.id));
  }

  return (
    <div className="relative flex flex-col min-h-full bg-[var(--bg-app)]">

      {/* Sticky header */}
      <div className="relative z-10 flex flex-col border-b border-slate-200 bg-white sticky top-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MASTER</div>
            <h2 className="text-2xl font-black text-slate-900">備品マスター</h2>
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
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="品名・メモで検索… （/ キーでフォーカス）"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-400"
              style={{ fontSize: '16px' }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {query && (
            <div className="text-[11px] text-slate-500 mt-1.5 px-1">
              {filteredItems.length === 0
                ? `「${query}」に一致する備品がありません`
                : `${items.length}件中 ${filteredItems.length}件`}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 pb-24">
        {items.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Package size={32} className="mx-auto mb-3 opacity-50" />
            <div className="text-sm">マスターアイテムがありません</div>
            {canEdit && <div className="text-xs mt-1 text-slate-400">「追加」から登録してください</div>}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm font-bold">「{query}」に一致する備品がありません</div>
            <div className="text-xs mt-1 text-slate-400">別のキーワードで試してください</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
            {filteredItems.map(item => (
              <motion.div
                key={item.id}
                layout
                className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors group shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-black text-sm text-slate-900 leading-snug">
                      {highlight(item.name, tokens)}
                    </div>
                    {item.yomi && tokens.length > 0 && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {highlight(item.yomi, tokens)}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 mb-1">
                  ¥{item.unitPrice.toLocaleString()} · デフォルト {item.defaultQuantity}個
                </div>
                {item.note && (
                  <div className="text-xs text-slate-400 mb-1">
                    {highlight(item.note, tokens)}
                  </div>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] text-indigo-600 flex items-center gap-0.5 hover:underline mt-1"
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
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => runWithGuard(closeForm)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full sm:max-w-md bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 z-10 max-h-[90dvh] overflow-y-auto"
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
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSave(); }}
                    {...autoKana.bind}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    style={{ fontSize: '16px' }}
                    placeholder="人工芝"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">フリガナ（自動・編集可）</label>
                  <input
                    value={form.yomi}
                    onChange={e => { setForm(v => ({ ...v, yomi: e.target.value })); autoKana.setReading(e.target.value); }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    style={{ fontSize: '16px' }}
                    placeholder="じんこうしば（品名入力で自動）"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">品名を入力すると自動で読みが入ります。違っていれば修正してください。</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">単価（¥）</label>
                    <input
                      type="number"
                      value={form.unitPrice}
                      onChange={e => setForm(v => ({ ...v, unitPrice: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                      style={{ fontSize: '16px' }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">デフォルト数量</label>
                    <input
                      type="number"
                      value={form.defaultQuantity}
                      onChange={e => setForm(v => ({ ...v, defaultQuantity: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                      style={{ fontSize: '16px' }}
                      placeholder="1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">メモ</label>
                  <input
                    value={form.note}
                    onChange={e => setForm(v => ({ ...v, note: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    style={{ fontSize: '16px' }}
                    placeholder="サイズ・色など"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">リンク URL</label>
                  <input
                    value={form.url}
                    onChange={e => setForm(v => ({ ...v, url: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:border-indigo-400 transition-colors text-[var(--text-primary)]"
                    style={{ fontSize: '16px' }}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => runWithGuard(closeForm)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-bold text-[var(--text-secondary)] hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => void handleSave()}
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
