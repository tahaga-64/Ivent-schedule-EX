import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { PreparationItem, Event, OrderStatus } from '../types';
import { Trash2, Plus, ArrowLeft, Save, ExternalLink, ClipboardList, Printer, FileSpreadsheet } from 'lucide-react';
import { motion } from 'motion/react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { computePrepProgressFields, effectiveArrived } from '../lib/prepProgress';
import { ARRIVAL_DESTINATIONS } from '../constants';

// ─── 発注ステータス ──────────────────────────────────────────────────────────

const ORDER_STEPS: Array<{ key: OrderStatus; label: string; activeCls: string; rowBg: string }> = [
  { key: 'unordered', label: '未発注', activeCls: 'bg-white/20 text-white/80 border-white/35', rowBg: '' },
  { key: 'ordered',   label: '発注済', activeCls: 'bg-amber-500/30 text-amber-200 border-amber-400/60', rowBg: 'bg-amber-500/18' },
  { key: 'shipping',  label: '配送中', activeCls: 'bg-blue-500/30 text-blue-200 border-blue-400/60', rowBg: 'bg-blue-500/18' },
  { key: 'arrived',   label: '着荷',   activeCls: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/60', rowBg: 'bg-emerald-500/18' },
];

const PREP_BG = 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1280&q=65';
const PREP_LABEL = 'text-[11px] font-black uppercase tracking-widest mb-1.5 text-white/70';
const PREP_INPUT = 'bg-slate-900/50 rounded-lg px-3 outline-none focus:ring-2 focus:ring-indigo-400/50 text-white/95 read-only:cursor-default';
const PREP_MONEY_INPUT = `${PREP_INPUT} py-3 text-base font-mono`;
const PREP_PANEL = 'bg-slate-950/88 backdrop-blur-md border-white/25 shadow-lg';

function prepRowBorderClass(item: PreparationItem): string {
  if (item.prepared) return 'border-l-indigo-500';
  if (effectiveArrived(item)) return 'border-l-emerald-400';
  const os = item.orderStatus ?? 'unordered';
  if (os === 'shipping') return 'border-l-blue-400';
  if (os === 'ordered') return 'border-l-amber-400';
  return 'border-l-white/15';
}

function prepItemCardClass(item: PreparationItem): string {
  const base = `${PREP_PANEL} border-white/25`;
  if (item.prepared) return `${base} opacity-80`;
  return base;
}

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
    arrivalDestination: '',
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
      '到着先': item.arrivalDestination ?? '',
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
      { wch: 4 }, { wch: 14 }, { wch: 8 }, { wch: 6 }, { wch: 8 },
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
  const deletedIdsRef = useRef<string[]>([]);
  const { runWithGuard, showSaveToast } = useUnsavedChanges();

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
    const toDelete = [...deletedIdsRef.current];
    setIsSaving(true);
    setSaveError(null);
    try {
      const batch = writeBatch(db);
      toSave.forEach(item => {
        batch.set(doc(db, `events/${event.id}/preparationItems`, item.id), item);
      });
      toDelete.forEach(id => {
        batch.delete(doc(db, `events/${event.id}/preparationItems`, id));
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
        deletedIdsRef.current = [];
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
    deletedIdsRef.current = [];
    hasChangesRef.current = false;
    setHasChanges(false);
    setItems(savedItemsRef.current);
  }, []);

  const handleManualSave = useCallback(async () => {
    if (!hasChanges || isSaving) return;
    const ok = await persistItems(itemsRef.current);
    if (ok) showSaveToast('保存されました');
  }, [hasChanges, isSaving, persistItems, showSaveToast]);

  useRegisterUnsavedGuard(`prep-${event.id}`, {
    enabled: canEdit,
    hasUnsaved: hasChanges,
    save: () => persistItems(itemsRef.current),
    discard: discardChanges,
    autoSaveOnNavigate: true,
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

  const removeItem = (id: string) => {
    if (!canEdit) return;
    if (items.length <= 1) return;
    if (savedItemsRef.current.some(i => i.id === id) && !deletedIdsRef.current.includes(id)) {
      deletedIdsRef.current.push(id);
    }
    editVersionRef.current += 1;
    setItems(prev => prev.filter(i => i.id !== id));
    setHasChanges(true);
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
          <div className="flex items-center gap-2 shrink-0">
            {hasChanges && !isSaving && !saveError && (
              <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap hidden sm:inline">未保存</span>
            )}
            {lastSavedAt !== null && !hasChanges && !isSaving && !saveError && (
              <span className="text-[11px] font-bold text-white/40 whitespace-nowrap hidden sm:inline">保存済</span>
            )}
            <button
              type="button"
              onClick={() => void handleManualSave()}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black transition-colors"
            >
              <Save size={14} className={isSaving ? 'animate-pulse' : ''} />
              {isSaving ? '保存中…' : '保存'}
            </button>
          </div>
        )}
      </div>

      {/* 準備物リスト（画面：カード形式・横スクロールなし） */}
      <div className="print:hidden flex-1 overflow-y-auto p-3 md:p-6 space-y-3">
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
            className={`border-l-4 rounded-2xl overflow-hidden shadow-md ${prepRowBorderClass(item)} ${prepItemCardClass(item)}`}
          >
            {/* Row 1: # + 品名 + badges + delete */}
            <div className="flex items-center gap-2 px-3 md:px-4 pt-3 pb-2">
              <span className="text-[11px] text-white/60 font-mono w-5 shrink-0">{idx + 1}</span>
              <input
                type="text"
                readOnly={!canEdit}
                value={item.name}
                onChange={e => updateItem(item.id, { name: e.target.value })}
                placeholder="アイテム名..."
                className={`flex-1 text-base font-black ${PREP_INPUT} placeholder:text-white/40 ${item.prepared ? 'line-through text-white/50' : 'text-white'}`}
              />
              {!item.prepared && os !== 'unordered' && (
                <span className={`shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full border ${step.activeCls}`}>
                  {step.label}
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
            {/* 到着予定日 / 到着先 / 発注状況 / 準備完了 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-3 md:px-4 py-3 border-t border-white/15">
              <div>
                <div className={PREP_LABEL}>到着予定日</div>
                <input
                  type="date"
                  readOnly={!canEdit}
                  value={item.arrivalDate ?? ''}
                  onChange={e => updateItem(item.id, { arrivalDate: e.target.value })}
                  className={`w-full text-sm font-mono ${PREP_INPUT} py-2.5 [color-scheme:dark]`}
                />
              </div>
              <div>
                <div className={PREP_LABEL}>到着先</div>
                <select
                  disabled={!canEdit}
                  value={item.arrivalDestination ?? ''}
                  onChange={e => updateItem(item.id, { arrivalDestination: e.target.value as '新宿' | '長南' | '' })}
                  className={`w-full text-sm font-bold ${PREP_INPUT} py-2.5 disabled:opacity-60 [color-scheme:dark]`}
                >
                  <option value="">—</option>
                  {ARRIVAL_DESTINATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <div className={PREP_LABEL}>発注状況</div>
                <OrderStatusPicker
                  status={item.orderStatus}
                  itemUrl={item.url}
                  disabled={!canEdit}
                  onChange={(s) => updateItem(item.id, { orderStatus: s, arrived: s === 'arrived' })}
                />
              </div>
              <div className="flex flex-col items-start md:items-center">
                <div className={`${PREP_LABEL} md:mb-1.5`}>準備完了</div>
                <Checkbox checked={item.prepared} disabled={!canEdit} onChange={() => updateItem(item.id, { prepared: !item.prepared })} />
              </div>
            </div>
            {/* 数量 / 単価 / 金額 / 配送料 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-3 md:px-4 py-3 border-t border-white/15 bg-white/[0.03]">
              <div>
                <div className={PREP_LABEL}>数量</div>
                <input
                  type="number"
                  readOnly={!canEdit}
                  value={item.quantity || ''}
                  onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                  className={`w-full ${PREP_MONEY_INPUT}`}
                />
              </div>
              <div>
                <div className={PREP_LABEL}>単価</div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-white/50 shrink-0">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.unitPrice || ''}
                    onChange={e => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                    className={`w-full min-w-0 ${PREP_MONEY_INPUT}`}
                  />
                </div>
              </div>
              <div>
                <div className={PREP_LABEL}>金額</div>
                <div className={`w-full ${PREP_MONEY_INPUT} flex items-center font-black`}>
                  ¥{(item.amount || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className={PREP_LABEL}>配送料</div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-white/50 shrink-0">¥</span>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    value={item.shippingFee || ''}
                    onChange={e => updateItem(item.id, { shippingFee: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className={`w-full min-w-0 ${PREP_MONEY_INPUT} placeholder:text-white/30`}
                  />
                </div>
              </div>
            </div>
            {/* Row 5: 備考 (shown if has content or canEdit) */}
            {(item.note || canEdit) && (
              <div className="border-t border-white/15 px-3 md:px-4 py-3">
                <div className={PREP_LABEL}>備考</div>
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
              <div className="border-t border-white/15 px-3 md:px-4 py-3">
                <div className={PREP_LABEL}>URL</div>
                {canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.url || ''}
                      onChange={e => updateItem(item.id, { url: e.target.value })}
                      placeholder="https://..."
                      className={`flex-1 text-sm min-w-0 placeholder:text-white/30 ${PREP_INPUT} py-2.5`}
                    />
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-white/60 hover:text-white">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/70 underline underline-offset-2 break-all"
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

      {/* 印刷専用テーブル */}
      <div className="hidden print:block w-full">
        <table className="w-full border-collapse text-[9pt]">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left border border-slate-300">#</th>
              <th className="px-2 py-2 text-left border border-slate-300">到着予定日</th>
              <th className="px-2 py-2 text-left border border-slate-300">到着先</th>
              <th className="px-2 py-2 text-left border border-slate-300">発注状況</th>
              <th className="px-2 py-2 text-center border border-slate-300">準備完了</th>
              <th className="px-2 py-2 text-left border border-slate-300">品名</th>
              <th className="px-2 py-2 text-right border border-slate-300">数量</th>
              <th className="px-2 py-2 text-right border border-slate-300">単価</th>
              <th className="px-2 py-2 text-right border border-slate-300">金額</th>
              <th className="px-2 py-2 text-right border border-slate-300">配送料</th>
              <th className="px-2 py-2 text-left border border-slate-300">備考</th>
              <th className="px-2 py-2 text-left border border-slate-300">URL</th>
            </tr>
          </thead>
          <tbody>
            {items.filter(i => !isEmptyItem(i)).map((item, idx) => {
              const rowStep = ORDER_STEPS.find(s => s.key === (item.orderStatus ?? 'unordered')) ?? ORDER_STEPS[0];
              return (
                <tr key={item.id}>
                  <td className="px-2 py-2 border border-slate-300 text-center">{idx + 1}</td>
                  <td className="px-2 py-2 border border-slate-300">{item.arrivalDate || '—'}</td>
                  <td className="px-2 py-2 border border-slate-300">{item.arrivalDestination || '—'}</td>
                  <td className="px-2 py-2 border border-slate-300">{rowStep.label}</td>
                  <td className="px-2 py-2 border border-slate-300 text-center">{item.prepared ? '✓' : '—'}</td>
                  <td className="px-2 py-2 border border-slate-300">{item.name}</td>
                  <td className="px-2 py-2 border border-slate-300 text-right">{item.quantity ?? ''}</td>
                  <td className="px-2 py-2 border border-slate-300 text-right">¥{(item.unitPrice || 0).toLocaleString()}</td>
                  <td className="px-2 py-2 border border-slate-300 text-right">¥{(item.amount || 0).toLocaleString()}</td>
                  <td className="px-2 py-2 border border-slate-300 text-right">¥{(item.shippingFee || 0).toLocaleString()}</td>
                  <td className="px-2 py-2 border border-slate-300">{item.note || '—'}</td>
                  <td className="px-2 py-2 border border-slate-300 break-all">{item.url || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 shrink-0 bg-slate-950/90 border-t border-white/20 print:bg-white print:border-slate-200 print:px-0 print:py-3">
        <div className="flex items-start gap-4 sm:gap-6 flex-wrap">
          {/* SUBTOTAL */}
          <div>
            <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-0.5 print:text-slate-500">商品計</div>
            <div className="text-base font-black text-white font-mono print:text-slate-900">¥{totals.subtotal.toLocaleString()}</div>
          </div>
          {/* SHIPPING */}
          <div>
            <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-0.5 print:text-slate-500">配送料</div>
            <div className="text-base font-black text-white font-mono print:text-slate-900">¥{totals.shipping.toLocaleString()}</div>
          </div>
          {/* TOTAL */}
          <div>
            <div className="text-[10px] font-black text-indigo-200/80 uppercase tracking-widest mb-0.5 print:text-slate-500">総支払</div>
            <div className="text-lg font-black text-indigo-100 font-mono print:text-slate-900">¥{totals.total.toLocaleString()}</div>
          </div>
          {/* PROGRESS */}
          <div className="flex-1 min-w-[160px] prep-print-hide">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">進捗</span>
              <span className="text-xs font-black text-indigo-200">
                {items.filter(i => !isEmptyItem(i)).length > 0
                  ? Math.round((totals.done / items.filter(i => !isEmptyItem(i)).length) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2 mb-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${items.filter(i => !isEmptyItem(i)).length > 0 ? (totals.done / items.filter(i => !isEmptyItem(i)).length) * 100 : 0}%` }}
                className="bg-indigo-400 h-2 rounded-full"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {totals.unorderedCount > 0 && <span className="text-[11px] font-black text-white/55">📋 {totals.unorderedCount}</span>}
              {totals.orderedCount > 0 && <span className="text-[11px] font-black text-amber-200">🛒 {totals.orderedCount}</span>}
              {totals.shippingCount > 0 && <span className="text-[11px] font-black text-blue-200">🚚 {totals.shippingCount}</span>}
              {totals.arrived > 0 && <span className="text-[11px] font-black text-emerald-200">✅ {totals.arrived}</span>}
              <span className="text-white/30">·</span>
              <span className="text-[11px] font-black text-indigo-200">✓ {totals.prepared}</span>
              <span className="text-white/30">·</span>
              <span className="text-xs font-black text-white/90">{items.filter(i => !isEmptyItem(i)).length}件</span>
            </div>
          </div>
          {/* 保存 / Excel / 印刷 */}
          <div className="flex gap-1.5 print:hidden self-end pb-0.5 flex-wrap justify-end">
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleManualSave()}
                disabled={!hasChanges || isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-black text-[10px] transition-colors"
              >
                <Save size={11} />
                {isSaving ? '保存中…' : '保存'}
              </button>
            )}
            <button
              onClick={onExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 text-white/60 hover:bg-white/20 rounded-lg font-bold text-[10px] transition-colors border border-white/15 disabled:opacity-50"
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
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
            } font-black ${
              isActive
                ? step.activeCls
                : 'bg-transparent text-white/50 border-white/20 hover:border-white/35 hover:text-white/70'
            }`}
          >
            <span>{step.label}</span>
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
      className={`w-full px-3 py-2.5 text-sm text-white/90 break-words placeholder:text-white/30 ${PREP_INPUT}`}
      style={{ resize: 'none', overflowX: 'hidden', minHeight: desktop ? '52px' : '38px' }}
    />
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
      className={`w-7 h-7 rounded border-2 flex items-center justify-center mx-auto transition-all ${
        checked ? activeClass : `border-white/40 bg-slate-900/40 ${hoverClass}`
      } disabled:opacity-40 disabled:pointer-events-none disabled:hover:border-white/40`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
