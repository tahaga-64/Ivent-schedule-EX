import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { PreparationItem, Event, OrderStatus } from '../types';
import { Trash2, Plus, ArrowLeft, Save, ExternalLink, ClipboardList, Printer, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { computePrepProgressFields, effectiveArrived } from '../lib/prepProgress';

// ─── 発注ステータス ──────────────────────────────────────────────────────────

const ORDER_STEPS: Array<{ key: OrderStatus; label: string; emoji: string; activeCls: string; rowBg: string }> = [
  { key: 'unordered', label: '未発注', emoji: '📋', activeCls: 'bg-white/15 text-white/60 border-white/30',        rowBg: '' },
  { key: 'ordered',   label: '発注済', emoji: '🛒', activeCls: 'bg-amber-500/25 text-amber-300 border-amber-400/50', rowBg: 'bg-amber-500/8' },
  { key: 'shipping',  label: '配送中', emoji: '🚚', activeCls: 'bg-blue-500/25 text-blue-300 border-blue-400/50',   rowBg: 'bg-blue-500/8' },
  { key: 'arrived',   label: '着荷',   emoji: '✅', activeCls: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50', rowBg: 'bg-emerald-500/10' },
];

const PREP_BG = 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1280&q=65';

interface Props {
  event: Event;
  onBack: () => void;
  /** 準備物の追加・編集・保存・削除を許可するか（ログイン済みなら true を渡す想定） */
  canEdit: boolean;
  user?: User | null;
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
    !item.prepared &&
    !item.orderStatus
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

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'export';
}

type ExportResult = { ok: true } | { ok: false; message: string };

async function handleExportExcel(event: Event, items: PreparationItem[]): Promise<ExportResult> {
  const filled = items.filter(i => !isEmptyItem(i));
  if (filled.length === 0) {
    return { ok: false, message: '出力する準備物がありません。品名などを入力してからお試しください。' };
  }
  try {
    const XLSX = await import('xlsx');
    const rows = filled.map((item, idx) => ({
      '#': idx + 1,
      '到着予定日': item.arrivalDate ?? '',
      '発注状況': ORDER_STEPS.find(s => s.key === (item.orderStatus ?? 'unordered'))?.label ?? '未発注',
      '準備完了': item.prepared ? '✓' : '',
      '品名': item.name,
      '数量': item.quantity,
      '単価': item.unitPrice,
      '金額': item.amount,
      '配送料': item.shippingFee,
      '備考': item.note,
      '備考記入者': item.noteUpdatedByName ?? item.noteUpdatedByEmail ?? '',
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
    const filename = `${sanitizeFilename(event.venue)}_準備物リスト_${event.start ?? ''}.xlsx`;
    XLSX.writeFile(wb, filename);
    return { ok: true };
  } catch (error) {
    console.error('PreparationList Excel export error:', error);
    return { ok: false, message: 'Excel出力に失敗しました。もう一度お試しください。' };
  }
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
}

export default function PreparationList({ event, onBack, canEdit, user }: Props) {
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // 編集ごとにインクリメント。保存中に編集が入ったかを判定して取りこぼしを防ぐ
  const editVersionRef = useRef(0);
  const savedItemsRef = useRef<PreparationItem[]>([]);
  const { runWithGuard } = useUnsavedChanges();

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
      const normalized = normalizeInitialItems(data);
      savedItemsRef.current = normalized;
      setItems(normalized);
    }, (error) => {
      console.error('PreparationList load error:', error);
    });
    return () => unsubscribe();
  }, [event.id]); // hasChanges は ref 経由で参照するため deps 不要

  const persistItems = useCallback(async (toSave: PreparationItem[]): Promise<boolean> => {
    if (!canEdit) return true;
    const version = editVersionRef.current;
    setIsSaving(true);
    setSaveError(null);
    try {
      const batch = writeBatch(db);
      toSave.forEach(item => {
        batch.set(doc(db, `events/${event.id}/preparationItems`, item.id), item);
      });
      await batch.commit();
      const budgetTotal = toSave.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0);
      const progress = computePrepProgressFields(toSave);
      updateDoc(doc(db, 'events', event.id), {
        prepBudgetTotal: budgetTotal,
        prepItemTotal: progress.prepItemTotal,
        prepItemDone: progress.prepItemDone,
      }).catch(() => {});
      if (editVersionRef.current === version) {
        setHasChanges(false);
        savedItemsRef.current = toSave;
      }
      setLastSavedAt(Date.now());
      return true;
    } catch (error) {
      console.error('PreparationList save error:', error);
      setSaveError(formatSaveError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, event.id]);

  const discardChanges = useCallback(() => {
    hasChangesRef.current = false;
    setHasChanges(false);
    setItems(savedItemsRef.current);
  }, []);

  useRegisterUnsavedGuard(`prep-${event.id}`, {
    enabled: canEdit,
    hasUnsaved: hasChanges,
    save: () => persistItems(itemsRef.current),
    discard: discardChanges,
  });

  const updateItem = (id: string, updates: Partial<PreparationItem>) => {
    if (!canEdit) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    let enriched = { ...updates };
    if ('note' in updates && user) {
      enriched = {
        ...enriched,
        noteUpdatedByName: user.displayName ?? null,
        noteUpdatedByEmail: user.email ?? null,
        noteUpdatedAt: new Date().toISOString(),
      };
    }
    const newItem = { ...item, ...enriched };
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
      const next = itemsRef.current.filter(i => i.id !== id);
      setItems(next);
      const budgetTotal = next.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0);
      const progress = computePrepProgressFields(next);
      await updateDoc(doc(db, 'events', event.id), {
        prepBudgetTotal: budgetTotal,
        prepItemTotal: progress.prepItemTotal,
        prepItemDone: progress.prepItemDone,
      });
      setIsSaving(false);
    } catch (error) {
      console.error('PreparationList delete error:', error);
      setSaveError(formatSaveError(error));
      setIsSaving(false);
    }
  };

  const totals = useMemo(() => {
    const filled = items.filter(i => !isEmptyItem(i));
    const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
    const shipping = items.reduce((s, i) => s + (i.shippingFee || 0), 0);
    const arrived = filled.filter(i => effectiveArrived(i)).length;
    const prepared = filled.filter(i => i.prepared).length;
    const done = filled.filter(i => effectiveArrived(i) && i.prepared).length;
    const orderedCount = filled.filter(i => i.orderStatus === 'ordered').length;
    const shippingCount = filled.filter(i => i.orderStatus === 'shipping').length;
    const unorderedCount = filled.filter(i => (i.orderStatus ?? 'unordered') === 'unordered').length;
    return { subtotal, shipping, total: subtotal + shipping, arrived, prepared, done, orderedCount, shippingCount, unorderedCount };
  }, [items]);

  const onExportExcel = async () => {
    setExportError(null);
    setIsExporting(true);
    const result = await handleExportExcel(event, items);
    setIsExporting(false);
    if (!result.ok) setExportError(result.message);
  };


  return (
    <>
    <div className="fixed lg:absolute inset-0 bg-cover bg-center print:hidden" style={{ backgroundImage: `url('${PREP_BG}')` }} />
    <div className="fixed lg:absolute inset-0 print:hidden" style={{ background: "linear-gradient(to bottom, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.90) 100%)" }} />
    <div
      id="prep-print-area"
      data-print-title={`${event.venue}　準備物リスト　${event.start}〜${event.end}`}
      className="relative z-10 flex flex-col h-full bg-transparent"
    >
      {!canEdit && (
        <div className="px-6 py-2.5 bg-white/10 border-b border-white/10 text-white/60 text-[11px] font-bold text-center print:hidden">
          閲覧のみ（準備物の編集にはログインが必要です）
        </div>
      )}
      {(saveError || exportError) && (
        <div
          role="alert"
          onClick={() => { setSaveError(null); setExportError(null); }}
          className="px-6 py-3 bg-red-500/20 border-b border-red-400/30 text-red-200 text-xs font-bold flex items-center gap-2 cursor-pointer print:hidden"
        >
          <span>⚠️</span>
          <span className="flex-1">{saveError ?? exportError}</span>
          <span className="text-[10px] opacity-60">タップで閉じる</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => runWithGuard(onBack)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-white leading-tight">{event.venue}</h2>
              {(() => {
                const filled = items.filter(i => !isEmptyItem(i)).length;
                if (filled === 0) return null;
                const allDone = totals.done === filled;
                return (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                    allDone
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
                  }`}>
                    {totals.done}/{filled}件完了
                  </span>
                );
              })()}
            </div>
            <span className="text-[11px] text-white/50 font-mono">{event.start} → {event.end}</span>
          </div>
        </div>
        {canEdit && (
          <SaveStatus isSaving={isSaving} hasChanges={hasChanges} error={!!saveError} savedOnce={lastSavedAt !== null} />
        )}
      </div>

      {/* Mobile card list — 印刷時はデスクトップ表を使用 */}
      <div className="block md:hidden print:hidden flex-1 overflow-y-auto p-3 space-y-2">
        {!canEdit && items.filter(i => !isEmptyItem(i)).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <ClipboardList size={36} className="mb-3" />
            <p className="text-sm font-bold text-slate-400">準備物が登録されていません</p>
          </div>
        )}
        {items.filter(item => canEdit || !isEmptyItem(item)).map((item, idx) => {
          const os = item.orderStatus ?? 'unordered';
          const step = ORDER_STEPS.find(s => s.key === os) ?? ORDER_STEPS[0];
          return (
          <div
            key={item.id}
            className={`border rounded-2xl overflow-hidden shadow-sm ${
              item.prepared
                ? 'bg-indigo-500/20 border-indigo-400/40'
                : effectiveArrived(item)
                  ? 'bg-emerald-500/15 border-emerald-400/35'
                  : os === 'shipping'
                    ? 'bg-blue-500/10 border-blue-400/30'
                    : os === 'ordered'
                      ? 'bg-amber-500/10 border-amber-400/25'
                      : 'bg-white/15 border-white/20'
            }`}
          >
            {/* Status stripe */}
            <div className={`h-1 ${
              item.prepared ? 'bg-indigo-500'
              : effectiveArrived(item) ? 'bg-emerald-400'
              : os === 'shipping' ? 'bg-blue-400'
              : os === 'ordered' ? 'bg-amber-400'
              : 'bg-white/20'
            }`} />
            {/* Row 1: # + 品名 + badges + delete */}
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
              <span className="text-[10px] text-white/40 font-mono w-5 shrink-0">{idx + 1}</span>
              <input
                type="text"
                readOnly={!canEdit}
                value={item.name}
                onChange={e => updateItem(item.id, { name: e.target.value })}
                placeholder="アイテム名..."
                className={`flex-1 text-base font-black bg-transparent outline-none read-only:cursor-default placeholder:text-white/30 ${item.prepared ? 'line-through text-white/40' : 'text-white'}`}
              />
              {!item.prepared && os !== 'unordered' && (
                <span className={`shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full border ${step.activeCls}`}>
                  {step.emoji} {step.label}
                </span>
              )}
              {item.prepared && (
                <span className="shrink-0 text-[10px] font-black text-indigo-200 bg-indigo-500/30 px-1.5 py-0.5 rounded-full border border-indigo-400/40">✓ 完了</span>
              )}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1 || !canEdit}
                className={`p-1 shrink-0 transition-colors ${
                  items.length <= 1 ? 'opacity-0 pointer-events-none' : !canEdit ? 'opacity-30 cursor-not-allowed' : 'text-white/30 hover:text-red-400'
                }`}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {/* Row 2: 数量 / 単価 / 金額 */}
            <div className="grid grid-cols-3 border-t border-white/15">
              <div className="px-3 py-2 border-r border-white/15">
                <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">数量</div>
                <input
                  type="number"
                  readOnly={!canEdit}
                  value={item.quantity || ''}
                  onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm font-mono text-white/80 bg-transparent outline-none read-only:cursor-default"
                />
              </div>
              <div className="px-3 py-2 border-r border-white/10">
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">単価</div>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-white/40">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.unitPrice || ''}
                    onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm font-mono text-white/80 bg-transparent outline-none read-only:cursor-default"
                  />
                </div>
              </div>
              <div className="px-3 py-2 bg-indigo-500/10">
                <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">金額</div>
                <div className="text-sm font-black text-indigo-300 font-mono">¥{(item.amount || 0).toLocaleString()}</div>
              </div>
            </div>
            {/* Row 3: 到着予定日 / 準備完了 */}
            <div className="grid grid-cols-2 border-t border-white/15">
              <div className="px-3 py-2 border-r border-white/15">
                <div className="text-[9px] font-black text-orange-300 uppercase tracking-widest mb-1">到着予定日</div>
                <input
                  type="date"
                  readOnly={!canEdit}
                  value={item.arrivalDate ?? ''}
                  onChange={e => updateItem(item.id, { arrivalDate: e.target.value })}
                  className="w-full text-xs font-mono text-white/80 bg-transparent outline-none read-only:cursor-default [color-scheme:dark]"
                />
              </div>
              <div className="px-3 py-2 flex flex-col items-center">
                <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1.5">準備完了</div>
                <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
              </div>
            </div>
            {/* Row 4: 発注状況 */}
            <div className="border-t border-white/15 px-3 py-2">
              <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5">発注状況</div>
              <OrderStatusPicker
                status={item.orderStatus}
                itemUrl={item.url}
                disabled={!canEdit}
                onChange={(s) => updateItem(item.id, { orderStatus: s, arrived: s === 'arrived' })}
              />
            </div>
            {/* Row 4: 配送料 */}
            <div className="border-t border-white/15">
              <div className="px-3 py-2">
                <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">配送料</div>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-white/40">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.shippingFee || ''}
                    onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-sm font-mono text-white/80 bg-transparent outline-none read-only:cursor-default placeholder:text-white/20"
                  />
                </div>
              </div>
            </div>
            {/* Row 5: 備考 (shown if has content or canEdit) */}
            {(item.note || canEdit) && (
              <div className="border-t border-white/15 px-3 py-2">
                <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">備考</div>
                <PreparationNoteField value={item.note || ''} readOnly={!canEdit} onChange={note => updateItem(item.id, { note })} />
                {item.noteUpdatedAt && (
                  <p className="text-[10px] text-white/30 mt-0.5 leading-tight">
                    {[item.noteUpdatedByName || item.noteUpdatedByEmail, formatNoteDate(item.noteUpdatedAt)].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
            {/* Row 6: URL (shown if has content or canEdit) */}
            {(item.url || canEdit) && (
              <div className="border-t border-white/15 px-3 py-2">
                <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">URL</div>
                {canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.url || ''}
                      onChange={e => updateItem(item.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 text-sm text-indigo-300 bg-transparent outline-none min-w-0 placeholder:text-white/20"
                    />
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-indigo-300 hover:text-indigo-200">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-300 underline underline-offset-2 break-all"
                  >
                    {item.url}
                  </a>
                ) : null}
              </div>
            )}
          </div>
          );
        })}
        {canEdit && (
          <button
            type="button"
            onClick={addItem}
            className="w-full py-4 bg-white/5 border-2 border-dashed border-white/20 hover:border-indigo-400/50 text-white/30 hover:text-indigo-300 text-xs font-black uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} /> 新しい項目を追加
          </button>
        )}
      </div>

      {/* Desktop table（印刷時も常に表形式） */}
      <div className="hidden md:block print:block flex-1 overflow-auto p-4 md:p-6 print:p-0 w-full">
        {!canEdit && items.filter(i => !isEmptyItem(i)).length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-white/40">
            <ClipboardList size={40} className="mb-3" />
            <p className="text-sm font-bold text-white/50">準備物が登録されていません</p>
          </div>
        )}
        {(canEdit || items.filter(i => !isEmptyItem(i)).length > 0) && (
        <div className="bg-white/15 border border-white/20 rounded-2xl overflow-hidden shadow-sm print:border-0 print:shadow-none print:rounded-none">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-sm print:text-[9pt] print:min-w-0" style={{ minWidth: '1200px' }}>
              <thead>
                <tr className="bg-white/10 border-b border-white/15">
                  <th className="w-10 px-3 py-3 text-[10px] font-black text-white/40 uppercase tracking-widest text-center border-r border-white/10">#</th>
                  <th className="w-32 px-3 py-3 text-[10px] font-black text-orange-300 uppercase tracking-widest text-center border-r border-white/10 bg-orange-500/10 whitespace-nowrap">到着予定日</th>
                  <th className="px-3 py-3 text-[10px] font-black text-amber-300 uppercase tracking-widest text-center border-r border-white/10 bg-amber-500/8 whitespace-nowrap" style={{ minWidth: '200px' }}>発注状況</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-indigo-300 uppercase tracking-widest text-center border-r border-white/10 bg-indigo-500/10 whitespace-nowrap">準備完了</th>
                  <th className="px-4 py-3 text-[10px] font-black text-white/60 uppercase tracking-widest text-left border-r border-white/10" style={{ minWidth: '200px' }}>品名</th>
                  <th className="w-20 px-3 py-3 text-[10px] font-black text-white/60 uppercase tracking-widest text-center border-r border-white/10">数量</th>
                  <th className="w-28 px-3 py-3 text-[10px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">単価</th>
                  <th className="w-32 px-3 py-3 text-[10px] font-black text-indigo-300 uppercase tracking-widest text-right border-r border-white/10 bg-indigo-500/10">金額</th>
                  <th className="w-28 px-3 py-3 text-[10px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">配送料</th>
                  <th className="px-4 py-3 text-[10px] font-black text-white/60 uppercase tracking-widest text-left border-r border-white/10" style={{ minWidth: '220px' }}>備考</th>
                  <th className="px-4 py-3 text-[10px] font-black text-white/60 uppercase tracking-widest text-left border-r border-white/10 print:text-slate-700" style={{ minWidth: '160px' }}>URL</th>
                  <th className="w-10 px-2 py-3 prep-print-hide" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((item, idx) => {
                  const rowOs = item.orderStatus ?? 'unordered';
                  const rowStep = ORDER_STEPS.find(s => s.key === rowOs) ?? ORDER_STEPS[0];
                  return (
                  <tr
                    key={item.id}
                    className={`group transition-colors ${
                      item.prepared ? 'bg-indigo-500/10'
                      : effectiveArrived(item) ? 'bg-emerald-500/10'
                      : rowStep.rowBg
                    } hover:bg-white/10 ${isEmptyItem(item) ? 'print:hidden' : ''}`}
                  >
                    <td className="px-3 py-3 text-center text-xs text-white/40 font-mono border-r border-white/10">{idx + 1}</td>
                    <td className="px-2 py-2 text-center border-r border-white/10 bg-orange-500/10">
                      <input
                        type="date"
                        readOnly={!canEdit}
                        value={item.arrivalDate ?? ''}
                        onChange={e => updateItem(item.id, { arrivalDate: e.target.value })}
                        className="w-full text-xs font-mono text-white/80 bg-transparent outline-none read-only:cursor-default text-center [color-scheme:dark]"
                      />
                    </td>
                    <td className={`px-3 py-2 border-r border-white/10 transition-colors ${rowStep.rowBg}`}>
                      <div className="print:hidden flex justify-center">
                        <OrderStatusPicker
                          status={item.orderStatus}
                          itemUrl={item.url}
                          disabled={!canEdit}
                          compact
                          onChange={(s) => updateItem(item.id, { orderStatus: s, arrived: s === 'arrived' })}
                        />
                      </div>
                      <PrintCheckMark checked={effectiveArrived(item)} />
                    </td>
                    <td className={`px-3 py-3 text-center border-r border-white/10 transition-colors ${item.prepared ? 'bg-indigo-500/20' : ''}`}>
                      <div className="print:hidden">
                        <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
                      </div>
                      <PrintCheckMark checked={item.prepared} />
                      {item.prepared && <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest print:hidden">済</span>}
                    </td>
                    <td className="p-0 border-r border-white/10">
                      <input
                        type="text"
                        readOnly={!canEdit}
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                        placeholder="アイテム名..."
                        className={`w-full px-4 py-3 bg-transparent outline-none focus:bg-white/10 text-sm font-medium text-white read-only:cursor-default placeholder:text-white/30 ${item.prepared ? 'line-through text-white/40' : ''}`}
                      />
                    </td>
                    <td className="p-0 border-r border-white/10">
                      <input
                        type="number"
                        readOnly={!canEdit}
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-3 bg-transparent outline-none focus:bg-white/10 text-sm font-mono text-white/80 text-center read-only:cursor-default"
                      />
                    </td>
                    <td className="p-0 border-r border-white/10">
                      <div className="flex items-center justify-end px-3 py-3 gap-1">
                        <span className="text-xs text-white/40">¥</span>
                        <input
                          type="number"
                          readOnly={!canEdit}
                          value={item.unitPrice || ''}
                          onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                          className="w-full bg-transparent outline-none focus:bg-white/10 text-sm font-mono text-white/80 text-right read-only:cursor-default"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-indigo-300 text-sm border-r border-white/10 bg-indigo-500/10 whitespace-nowrap">
                      ¥{(item.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-0 border-r border-white/10">
                      <div className="flex items-center justify-end px-3 py-3 gap-1">
                        <input
                          type="number"
                          readOnly={!canEdit}
                          value={item.shippingFee || ''}
                          onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full bg-transparent outline-none focus:bg-white/10 text-sm font-mono text-white/80 text-right read-only:cursor-default placeholder:text-white/20"
                        />
                      </div>
                    </td>
                    <td className="p-0 border-r border-white/10">
                      <PreparationNoteField
                        value={item.note || ''}
                        readOnly={!canEdit}
                        onChange={note => updateItem(item.id, { note })}
                        desktop
                      />
                      {item.noteUpdatedAt && (
                        <p className="px-4 pb-1.5 text-[10px] text-white/30 leading-tight">
                          {[item.noteUpdatedByName || item.noteUpdatedByEmail, formatNoteDate(item.noteUpdatedAt)].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="p-0 border-r border-white/10">
                      {canEdit ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={item.url || ''}
                            onChange={e => updateItem(item.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="flex-1 px-2 py-1.5 bg-transparent outline-none focus:bg-white/10 text-sm text-indigo-300 min-w-0 placeholder:text-white/20"
                          />
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-indigo-300 hover:text-indigo-200 p-1">
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      ) : item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-3 text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2 break-all"
                        >
                          {item.url}
                          <ExternalLink size={12} className="shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <span className="px-4 py-3 block text-sm text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center prep-print-hide">
                      {canEdit && items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={addItem}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/30 hover:text-indigo-300 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-t border-white/10 print:hidden"
            >
              <Plus size={14} /> 新しい項目を追加
            </button>
          )}
        </div>
        )}
      </div>

      {/* Footer — no card boxes, background image shows through */}
      <div className="px-5 py-2.5 shrink-0 print:bg-white print:border-t print:border-slate-200 print:px-0 print:py-3">
        <div className="flex items-start gap-4 sm:gap-6 flex-wrap">
          {/* SUBTOTAL */}
          <div>
            <div className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 print:text-slate-500">商品計</div>
            <div className="text-sm font-black text-white font-mono print:text-slate-900">¥{totals.subtotal.toLocaleString()}</div>
          </div>
          {/* SHIPPING */}
          <div>
            <div className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 print:text-slate-500">配送料</div>
            <div className="text-sm font-black text-white font-mono print:text-slate-900">¥{totals.shipping.toLocaleString()}</div>
          </div>
          {/* TOTAL */}
          <div>
            <div className="text-[8px] font-black text-indigo-300/70 uppercase tracking-widest mb-0.5 print:text-slate-500">総支払</div>
            <div className="text-base font-black text-indigo-200 font-mono print:text-slate-900">¥{totals.total.toLocaleString()}</div>
          </div>
          {/* PROGRESS */}
          <div className="flex-1 min-w-[160px] prep-print-hide">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">進捗</span>
              <span className="text-[10px] font-black text-indigo-300">
                {items.filter(i => !isEmptyItem(i)).length > 0
                  ? Math.round((totals.done / items.filter(i => !isEmptyItem(i)).length) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-white/15 rounded-full h-1 mb-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${items.filter(i => !isEmptyItem(i)).length > 0 ? (totals.done / items.filter(i => !isEmptyItem(i)).length) * 100 : 0}%` }}
                className="bg-indigo-400 h-1 rounded-full"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {totals.unorderedCount > 0 && <span className="text-[10px] font-black text-white/35">📋 {totals.unorderedCount}</span>}
              {totals.orderedCount > 0 && <span className="text-[10px] font-black text-amber-300">🛒 {totals.orderedCount}</span>}
              {totals.shippingCount > 0 && <span className="text-[10px] font-black text-blue-300">🚚 {totals.shippingCount}</span>}
              {totals.arrived > 0 && <span className="text-[10px] font-black text-emerald-300">✅ {totals.arrived}</span>}
              <span className="text-white/20">·</span>
              <span className="text-[10px] font-black text-indigo-300">✓ {totals.prepared}</span>
              <span className="text-white/20">·</span>
              <span className="text-[11px] font-black text-white/80">{items.filter(i => !isEmptyItem(i)).length}件</span>
            </div>
          </div>
          {/* Excel / 印刷 buttons */}
          <div className="flex gap-1.5 print:hidden self-end pb-0.5">
            <button
              onClick={onExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg font-bold text-[10px] transition-colors border border-emerald-400/25 disabled:opacity-50"
              title="Excelファイルとしてダウンロード"
            >
              <FileSpreadsheet size={11} />
              {isExporting ? '...' : 'Excel'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 text-white/60 hover:bg-white/20 rounded-lg font-bold text-[10px] transition-colors border border-white/15"
              title="印刷"
            >
              <Printer size={11} />
              印刷
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function OrderStatusPicker({
  status,
  itemUrl,
  disabled,
  compact,
  onChange,
}: {
  status: OrderStatus | undefined;
  itemUrl?: string;
  disabled?: boolean;
  compact?: boolean;
  onChange: (s: OrderStatus) => void;
}) {
  const current: OrderStatus = status ?? 'unordered';
  return (
    <div className={`flex items-center flex-wrap ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {ORDER_STEPS.map(step => {
        const isActive = current === step.key;
        return (
          <button
            key={step.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(step.key)}
            title={step.label}
            className={`flex items-center gap-0.5 rounded border transition-all disabled:pointer-events-none ${
              compact ? 'px-1 py-0.5 text-[9px]' : 'px-2 py-1 text-[11px]'
            } font-black ${
              isActive
                ? step.activeCls
                : 'bg-transparent text-white/20 border-white/10 hover:border-white/30 hover:text-white/40'
            }`}
          >
            <span>{step.emoji}</span>
            {!compact && <span className="ml-0.5">{step.label}</span>}
          </button>
        );
      })}
      {current === 'unordered' && itemUrl && !disabled && (
        <a
          href={itemUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onChange('ordered')}
          className="ml-1 text-[10px] font-black text-amber-300 hover:text-amber-200 border border-amber-400/40 rounded px-2 py-0.5 whitespace-nowrap bg-amber-500/10 transition-colors"
        >
          発注する →
        </a>
      )}
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
      className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-white/10 text-sm text-white/70 break-words read-only:cursor-default placeholder:text-white/20"
      style={{ resize: 'none', overflowX: 'hidden', minHeight: desktop ? '52px' : '38px' }}
    />
  );
}

function SaveStatus({ isSaving, hasChanges, error, savedOnce }: { isSaving: boolean; hasChanges: boolean; error: boolean; savedOnce: boolean }) {
  if (error) {
    return <span className="text-[11px] font-bold text-red-300 whitespace-nowrap">⚠️ 保存エラー</span>;
  }
  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 whitespace-nowrap">
        <Save size={12} className="animate-pulse" /> 保存中…
      </span>
    );
  }
  if (hasChanges) {
    return <span className="text-[11px] font-bold text-white/50 whitespace-nowrap">未保存…</span>;
  }
  if (savedOnce) {
    return <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap">✓ 自動保存済み</span>;
  }
  return null;
}

function PrintCheckMark({ checked }: { checked: boolean }) {
  return (
    <span className="hidden print:inline text-sm font-bold text-slate-900">
      {checked ? '✓' : '—'}
    </span>
  );
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
        checked ? activeClass : `border-white/30 bg-white/5 ${hoverClass}`
      } disabled:opacity-40 disabled:pointer-events-none disabled:hover:border-white/30`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
