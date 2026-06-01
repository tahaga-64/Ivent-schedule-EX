import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { PreparationItem, Event } from '../types';
import { Trash2, Plus, ArrowLeft, Save, ExternalLink, ClipboardList, Printer, FileSpreadsheet, Briefcase, MessageSquare, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PREP_BG = "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1920&q=80";

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

async function handleExportExcel(event: Event, items: PreparationItem[]) {
  const XLSX = await import('xlsx');
  const rows = items.filter(i => !isEmptyItem(i)).map((item, idx) => ({
    '#': idx + 1,
    '到着予定日': item.arrivalDate ?? '',
    '到着': item.arrived ? '✓' : '',
    '準備完了': item.prepared ? '✓' : '',
    '品名': item.name,
    '数量': item.quantity,
    '単価': item.unitPrice,
    '金額': item.amount,
    '配送料': item.shippingFee,
    '備考': item.note,
    'URL': item.url ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 6 }, { wch: 8 },
    { wch: 30 }, { wch: 6 }, { wch: 10 }, { wch: 12 },
    { wch: 10 }, { wch: 30 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '準備物リスト');
  const filename = `${event.venue}_準備物リスト_${event.start ?? ''}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export default function PreparationList({ event, onBack, canEdit }: Props) {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // 編集ごとにインクリメント。保存中に編集が入ったかを判定して取りこぼしを防ぐ
  const editVersionRef = useRef(0);

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

  // 変更を Firestore に保存（自動保存の共通処理）
  const persistItems = useCallback(async (toSave: PreparationItem[]) => {
    if (!canEdit) return;
    const version = editVersionRef.current;
    setIsSaving(true);
    setSaveError(null);
    try {
      const batch = writeBatch(db);
      toSave.forEach(item => {
        batch.set(doc(db, `events/${event.id}/preparationItems`, item.id), item);
      });
      await batch.commit();
      const total = toSave.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0);
      updateDoc(doc(db, 'events', event.id), { prepBudgetTotal: total }).catch(() => {});
      // 保存中にさらに編集が入っていなければ「保存済み」に確定する
      if (editVersionRef.current === version) setHasChanges(false);
      setLastSavedAt(Date.now());
    } catch (error) {
      console.error('PreparationList save error:', error);
      setSaveError(formatSaveError(error));
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, event.id]);

  // チェック・入力をデバウンスで自動保存（「保存」を押さず離脱しても消えない）
  useEffect(() => {
    if (!canEdit || !hasChanges) return;
    const t = setTimeout(() => { void persistItems(itemsRef.current); }, 800);
    return () => clearTimeout(t);
  }, [items, hasChanges, canEdit, persistItems]);

  const updateItem = (id: string, updates: Partial<PreparationItem>) => {
    if (!canEdit) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newItem = { ...item, ...updates };
    newItem.amount = (newItem.quantity || 0) * (newItem.unitPrice || 0);
    editVersionRef.current += 1;
    setItems(prev => prev.map(i => i.id === id ? newItem : i));
    setHasChanges(true);
  };

  const addItem = () => {
    if (!canEdit) return;
    editVersionRef.current += 1;
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
    <>
    <div className="fixed inset-0 bg-cover bg-center print:hidden" style={{ backgroundImage: `url('${PREP_BG}')` }} />
    <div className="fixed inset-0 print:hidden" style={{ background: "linear-gradient(to bottom, rgba(15,23,42,0.25) 0%, rgba(15,23,42,0.55) 100%)" }} />
    <div
      id="prep-print-area"
      data-print-title={`${event.venue}　準備物リスト　${event.start}〜${event.end}`}
      className="relative z-10 flex flex-col h-full bg-white/95"
    >
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowProposal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-xl font-bold text-xs transition-colors print:hidden border border-violet-200"
            title="商談提案用PDFを作成"
          >
            <Briefcase size={13} />
            <span>商談提案</span>
          </button>
          <button
            onClick={() => handleExportExcel(event, items)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-bold text-xs transition-colors print:hidden border border-emerald-200"
            title="Excelファイルとしてダウンロード"
          >
            <FileSpreadsheet size={13} />
            <span>Excel出力</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors print:hidden border border-slate-200"
            title="印刷"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">印刷</span>
          </button>
          {canEdit && (
            <SaveStatus isSaving={isSaving} hasChanges={hasChanges} error={!!saveError} savedOnce={lastSavedAt !== null} />
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="block lg:hidden flex-1 overflow-y-auto p-3 space-y-2">
        {!canEdit && items.filter(i => !isEmptyItem(i)).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <ClipboardList size={36} className="mb-3" />
            <p className="text-sm font-bold text-slate-400">準備物が登録されていません</p>
          </div>
        )}
        {items.filter(item => canEdit || !isEmptyItem(item)).map((item, idx) => (
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
            {/* Row 3: 到着予定日 / 到着 / 準備 */}
            <div className="grid grid-cols-3 border-t border-gray-100">
              <div className="px-3 py-2 border-r border-gray-100">
                <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">到着予定日</div>
                <input
                  type="date"
                  readOnly={!canEdit}
                  value={item.arrivalDate ?? ''}
                  onChange={e => updateItem(item.id, { arrivalDate: e.target.value })}
                  className="w-full text-xs font-mono text-gray-700 bg-transparent outline-none read-only:cursor-default"
                />
              </div>
              <div className="px-3 py-2 flex flex-col items-center border-r border-gray-100">
                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">到着</div>
                <Checkbox checked={item.arrived} disabled={!canEdit} onChange={() => updateItem(item.id, { arrived: !item.arrived })} color="emerald" />
              </div>
              <div className="px-3 py-2 flex flex-col items-center">
                <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">準備完了</div>
                <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
              </div>
            </div>
            {/* Row 4: 配送料 */}
            <div className="border-t border-gray-100">
              <div className="px-3 py-2">
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
        {!canEdit && items.filter(i => !isEmptyItem(i)).length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <ClipboardList size={40} className="mb-3" />
            <p className="text-sm font-bold text-slate-400">準備物が登録されていません</p>
          </div>
        )}
        {(canEdit || items.filter(i => !isEmptyItem(i)).length > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '1200px' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-3 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center border-r border-gray-100">#</th>
                  <th className="w-32 px-3 py-3 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center border-r border-gray-100 bg-orange-50/40 whitespace-nowrap">到着予定日</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center border-r border-gray-100 bg-emerald-50/40">到着</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-r border-gray-100 bg-indigo-50/40 whitespace-nowrap">準備完了</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '200px' }}>品名</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center border-r border-gray-100">数量</th>
                  <th className="w-28 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right border-r border-gray-100">単価</th>
                  <th className="w-32 px-3 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right border-r border-gray-100 bg-indigo-50/40">金額</th>
                  <th className="w-28 px-3 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right border-r border-gray-100">配送料</th>
                  <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-widest text-left border-r border-gray-100" style={{ minWidth: '220px' }}>備考</th>
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
                    <td className={`px-2 py-2 text-center border-r border-gray-100 bg-orange-50/30`}>
                      <input
                        type="date"
                        readOnly={!canEdit}
                        value={item.arrivalDate ?? ''}
                        onChange={e => updateItem(item.id, { arrivalDate: e.target.value })}
                        className="w-full text-xs font-mono text-gray-700 bg-transparent outline-none read-only:cursor-default text-center"
                      />
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
                    <td className="px-3 py-3 text-right font-mono font-black text-indigo-600 text-sm border-r border-gray-100 bg-indigo-50/30 whitespace-nowrap">
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

      {/* Footer */}
      <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-100 shrink-0">
        {/* 自動保存のため手動保存ボタンは廃止。保存状態はヘッダーに表示 */}
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
              {items.length > 0 ? Math.round((totals.done / items.length) * 100) : 0}%
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${items.length > 0 ? (totals.done / items.length) * 100 : 0}%` }}
              className="bg-indigo-600 h-1.5 rounded-full"
            />
          </div>
          <div className="flex gap-2 text-[10px] font-bold text-gray-400">
            <span>到着 {totals.arrived}</span>
            <span className="text-gray-300">·</span>
            <span>準備完了 {totals.prepared}</span>
            <span className="text-gray-300">·</span>
            <span>{items.length} 件</span>
          </div>
        </div>
      </div>
      </div>
    </div>
    <AnimatePresence>
      {showProposal && (
        <ProposalModal
          event={event}
          items={items.filter(i => !isEmptyItem(i))}
          totals={totals}
          onClose={() => setShowProposal(false)}
        />
      )}
    </AnimatePresence>
    </>
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

function SaveStatus({ isSaving, hasChanges, error, savedOnce }: { isSaving: boolean; hasChanges: boolean; error: boolean; savedOnce: boolean }) {
  if (error) {
    return <span className="text-[11px] font-bold text-red-500 whitespace-nowrap">⚠️ 保存エラー</span>;
  }
  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 whitespace-nowrap">
        <Save size={12} className="animate-pulse" /> 保存中…
      </span>
    );
  }
  if (hasChanges) {
    return <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">未保存…</span>;
  }
  if (savedOnce) {
    return <span className="text-[11px] font-bold text-emerald-600 whitespace-nowrap">✓ 自動保存済み</span>;
  }
  return null;
}

function Checkbox({ checked, onChange, disabled, color = 'indigo' }: { checked: boolean; onChange: () => void; disabled?: boolean; color?: 'indigo' | 'emerald' }) {
  const activeClass = color === 'emerald'
    ? 'bg-emerald-500 border-emerald-500'
    : 'bg-indigo-600 border-indigo-600';
  const hoverClass = color === 'emerald'
    ? 'hover:border-emerald-400'
    : 'hover:border-indigo-400';
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all ${
        checked ? activeClass : `border-gray-300 ${hoverClass}`
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

function ProposalModal({
  event,
  items,
  totals,
  onClose,
}: {
  event: Event;
  items: PreparationItem[];
  totals: { subtotal: number; shipping: number; total: number };
  onClose: () => void;
}) {
  function handleProposalPrint() {
    document.body.classList.add('printing-proposal');
    window.print();
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-proposal');
    }, { once: true });
  }

  function handleLineShare() {
    const dateRange = event.end && event.end !== event.start
      ? `${event.start} 〜 ${event.end}`
      : event.start;
    const itemLines = items
      .map((item, i) =>
        `  ${i + 1}. ${item.name}（${item.quantity}個）¥${item.amount.toLocaleString()}`
      )
      .join('\n');
    const text = [
      `【商談提案】${event.venue}`,
      `期間: ${dateRange}`,
      event.client ? `クライアント: ${event.client}` : null,
      '',
      '◆ 準備物リスト',
      itemLines,
      '',
      `商品計: ¥${totals.subtotal.toLocaleString()}`,
      `配送料: ¥${totals.shipping.toLocaleString()}`,
      `合計:   ¥${totals.total.toLocaleString()}`,
    ].filter(l => l !== null).join('\n');
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  return createPortal(
    <div id="proposal-modal-root" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm proposal-no-print"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        id="proposal-print-area"
      >
        {/* Header chrome — 印刷時非表示 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 proposal-no-print">
          <div>
            <div className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-0.5">商談提案用</div>
            <h3 className="text-base font-black text-slate-900">{event.venue}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLineShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#06C755] hover:bg-[#05B34C] text-white rounded-xl font-black text-xs transition-colors"
            >
              <MessageSquare size={13} />
              LINEで共有
            </button>
            <button
              onClick={handleProposalPrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-xl font-black text-xs transition-colors"
            >
              <Download size={13} />
              PDFで保存
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* スクロール可能なコンテンツ（印刷時は overflow visible） */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6" id="proposal-content">
          {/* カバー */}
          <div className="text-center py-4 border-b border-slate-100">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">BUSINESS PROPOSAL</div>
            <h1 className="text-2xl font-black text-slate-900 mb-1">{event.venue}</h1>
            <div className="text-sm text-slate-500">
              {event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ''}
              {event.client && (
                <> · <span className="font-bold text-slate-700">{event.client}</span></>
              )}
            </div>
            {event.type && (
              <div className="mt-2 inline-block px-3 py-1 bg-violet-50 text-violet-700 text-xs font-black rounded-full">
                {event.type}
              </div>
            )}
          </div>

          {/* 品目テーブル */}
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">準備物一覧</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 text-xs font-black text-slate-400 pr-3">#</th>
                  <th className="text-left py-2 text-xs font-black text-slate-400">品名</th>
                  <th className="text-right py-2 text-xs font-black text-slate-400 px-3">数量</th>
                  <th className="text-right py-2 text-xs font-black text-slate-400 px-3">単価</th>
                  <th className="text-right py-2 text-xs font-black text-slate-400 px-3">金額</th>
                  <th className="text-right py-2 text-xs font-black text-slate-400">配送料</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                    <td className="py-2.5 font-medium text-slate-800">
                      {item.name}
                      {item.note && <div className="text-xs text-slate-400 mt-0.5">{item.note}</div>}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-700 px-3">{item.quantity}</td>
                    <td className="py-2.5 text-right font-mono text-slate-700 px-3">¥{item.unitPrice.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900 px-3">¥{item.amount.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-slate-500">
                      {item.shippingFee > 0 ? `¥${item.shippingFee.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 合計 */}
          <div className="border-t-2 border-slate-200 pt-4 flex flex-col items-end gap-1.5">
            <div className="flex gap-8 text-sm">
              <span className="text-slate-500">商品計</span>
              <span className="font-mono font-bold text-slate-800 w-28 text-right">¥{totals.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex gap-8 text-sm">
              <span className="text-slate-500">配送料計</span>
              <span className="font-mono font-bold text-slate-800 w-28 text-right">¥{totals.shipping.toLocaleString()}</span>
            </div>
            <div className="flex gap-8 text-lg border-t border-slate-200 pt-2 mt-1">
              <span className="font-black text-slate-900">合計（税抜）</span>
              <span className="font-mono font-black text-violet-700 w-28 text-right">¥{totals.total.toLocaleString()}</span>
            </div>
          </div>

          {/* フッター */}
          <div className="text-xs text-slate-400 text-center pt-4 border-t border-slate-100">
            本資料は {new Date().toLocaleDateString('ja-JP')} 時点の情報です。
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
