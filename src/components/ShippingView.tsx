import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { Truck, PackageCheck, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeOrderStatus, ORDER_STATUS_LABELS } from '../lib/orderStatus';
import {
  hasDestination,
  isPendingShippingItem,
  groupByDestination,
  destDotColor,
  type ShippingItem,
} from '../lib/shipping';
import {
  exportRowsToXlsx,
  exportSheetsToXlsx,
  sanitizeFilename,
  type SheetRow,
} from '../lib/spreadsheet';
import type { Event, OrderStatus } from '../types';

interface Props {
  events: Event[];
  canEdit: boolean;
  user: User | null;
}

/** 発注状況の編集ステップ（着荷まで） */
const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'unordered', label: '未発注' },
  { key: 'ordered', label: '発注済' },
  { key: 'shipping', label: '配送中' },
  { key: 'arrived', label: '着荷' },
];

/** xlsx 出力の列幅（届け先, イベント, 品名, 数量, 発注状況, 到着予定日, 追跡番号, 単価, 金額, 配送料, 備考, URL） */
const EXPORT_COL_WIDTHS = [10, 18, 22, 6, 10, 12, 16, 8, 10, 8, 24, 28];

function buildRow(item: ShippingItem, dest: string): SheetRow {
  return {
    '届け先': dest,
    'イベント': item.eventVenue,
    '品名': item.name,
    '数量': item.quantity,
    '発注状況': ORDER_STATUS_LABELS[normalizeOrderStatus(item.orderStatus)],
    '到着予定日': item.arrivalDate ?? '',
    '追跡番号': item.trackingNumber ?? '',
    '単価': item.unitPrice,
    '金額': item.amount,
    '配送料': item.shippingFee,
    '備考': item.note ?? '',
    'URL': item.url ?? '',
  };
}

/** 着荷状態のバッジ色 */
function statusBadge(status: OrderStatus | undefined): string {
  switch (status) {
    case 'arrived':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'shipping':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'ordered':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200';
  }
}

/** 現在の orderStatus を STEPS のキーに正規化（編集用：arrived は arrived のまま残す） */
function toStepKey(status: OrderStatus | undefined): OrderStatus {
  if (status === 'arrived' || status === 'completed') return 'arrived';
  if (status === 'shipping') return 'shipping';
  if (status === 'ordered') return 'ordered';
  return 'unordered';
}

export default function ShippingView({ events, canEdit }: Props) {
  const [items, setItems] = useState<ShippingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const activeEvents = events.filter(e => e.status !== 'cancelled');
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const nested = await Promise.all(
          activeEvents.map(async ev => {
            const snap = await getDocs(
              collection(db, `events/${ev.id}/preparationItems`),
            );
            return snap.docs
              .map(d => ({
                id: d.id,
                eventId: ev.id,
                eventVenue: ev.venue,
                eventStart: ev.start,
                ...d.data(),
              } as ShippingItem))
              .filter(item => hasDestination(item));
          }),
        );
        if (!cancelled) setItems(nested.flat());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [events, reloadKey]);

  const visibleItems = useMemo(
    () => (pendingOnly ? items.filter(isPendingShippingItem) : items),
    [items, pendingOnly],
  );

  const groups = useMemo(() => groupByDestination(visibleItems), [visibleItems]);

  // 選択中の届け先を有効な範囲に保つ
  useEffect(() => {
    if (groups.length === 0) {
      if (selectedDest !== null) setSelectedDest(null);
      return;
    }
    if (!selectedDest || !groups.some(g => g.destination === selectedDest)) {
      setSelectedDest(groups[0].destination);
    }
  }, [groups, selectedDest]);

  const activeGroup = useMemo(
    () => groups.find(g => g.destination === selectedDest) ?? groups[0] ?? null,
    [groups, selectedDest],
  );

  // 届け先内をイベント会場 → order で並べ替え
  const activeItems = useMemo(() => {
    if (!activeGroup) return [];
    return [...activeGroup.items].sort((a, b) => {
      const v = a.eventVenue.localeCompare(b.eventVenue, 'ja');
      if (v !== 0) return v;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [activeGroup]);

  const handleStatusChange = useCallback(
    async (item: ShippingItem, newStatus: OrderStatus) => {
      const key = `${item.eventId}-${item.id}`;
      if (savingId === key) return;
      setSavingId(key);
      const arrived = newStatus === 'arrived';
      try {
        await updateDoc(
          doc(db, `events/${item.eventId}/preparationItems/${item.id}`),
          { orderStatus: newStatus, arrived, prepared: arrived },
        );
        setItems(prev =>
          prev.map(i =>
            i.id === item.id && i.eventId === item.eventId
              ? { ...i, orderStatus: newStatus, arrived, prepared: arrived }
              : i,
          ),
        );
      } catch (err) {
        console.error('Failed to update order status:', err);
      } finally {
        setSavingId(null);
      }
    },
    [savingId],
  );

  const handleExportCurrent = useCallback(() => {
    if (!activeGroup) return;
    const dest = activeGroup.destination;
    const rows = [...activeGroup.items]
      .sort((a, b) => {
        const v = a.eventVenue.localeCompare(b.eventVenue, 'ja');
        if (v !== 0) return v;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map(it => buildRow(it, dest));
    exportRowsToXlsx(
      '発注リスト',
      `${sanitizeFilename(dest)}_発注リスト.xlsx`,
      rows,
      EXPORT_COL_WIDTHS,
    ).catch(err => console.error('Export failed:', err));
  }, [activeGroup]);

  const handleExportAll = useCallback(() => {
    if (groups.length === 0) return;
    const sheets = groups.map(g => ({
      name: sanitizeFilename(g.destination),
      rows: [...g.items]
        .sort((a, b) => {
          const v = a.eventVenue.localeCompare(b.eventVenue, 'ja');
          if (v !== 0) return v;
          return (a.order ?? 0) - (b.order ?? 0);
        })
        .map(it => buildRow(it, g.destination)),
      colWidths: EXPORT_COL_WIDTHS,
    }));
    exportSheetsToXlsx(sheets, '発注・郵送リスト_全届け先.xlsx').catch(err =>
      console.error('Export failed:', err),
    );
  }, [groups]);

  const hasAnyDestItems = items.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="shrink-0 border-b border-slate-100 px-4 sm:px-6 pt-4 pb-3 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Truck size={20} className="text-indigo-500 shrink-0" />
              <h1 className="text-lg font-black text-slate-900">発注・郵送</h1>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              届け先ごとの発注・郵送リスト
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey(k => k + 1)}
            disabled={loading}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            更新
          </button>
        </div>

        {/* ツールバー: 未完了のみ + 出力 */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => setPendingOnly(p => !p)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors ${
              pendingOnly
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${pendingOnly ? 'bg-white' : 'bg-slate-300'}`}
            />
            未完了のみ
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleExportCurrent}
              disabled={!activeGroup}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              このリストを出力
            </button>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={groups.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-indigo-600" />
              全届け先を出力
            </button>
          </div>
        </div>

        {/* 届け先タブ */}
        {groups.length > 0 && (
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map(g => {
              const active = g.destination === activeGroup?.destination;
              return (
                <button
                  key={g.destination}
                  type="button"
                  onClick={() => setSelectedDest(g.destination)}
                  className={`shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black transition-all ${
                    active
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: destDotColor(g.destination) }}
                  />
                  {g.destination}
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {g.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 本体 */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            読み込み中…
          </div>
        ) : !hasAnyDestItems ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <PackageCheck size={36} className="text-slate-300" />
            <div className="text-sm font-black text-slate-700">届け先付きの準備物はありません</div>
            <div className="text-xs text-slate-400">
              準備物に届け先を設定すると、ここに表示されます
            </div>
          </div>
        ) : !activeGroup ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <PackageCheck size={36} className="text-emerald-400" />
            <div className="text-sm font-black text-slate-700">未完了の発注はありません</div>
            <div className="text-xs text-slate-400">すべて着荷済みです</div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {/* 届け先見出し（このページの主役） */}
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: destDotColor(activeGroup.destination) }}
              />
              <h2 className="text-base font-black text-slate-900">{activeGroup.destination}</h2>
              <span className="text-xs font-bold text-slate-400">{activeItems.length}件</span>
            </div>

            <div className="space-y-2">
              {activeItems.map(item => {
                const norm = normalizeOrderStatus(item.orderStatus);
                const stepKey = toStepKey(item.orderStatus);
                const key = `${item.eventId}-${item.id}`;
                const saving = savingId === key;
                return (
                  <div
                    key={key}
                    className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              ×{item.quantity}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {item.eventVenue}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-mono">
                            到着予定: {item.arrivalDate || '—'}
                          </span>
                          {item.trackingNumber && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              追跡: {item.trackingNumber}
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <div className="text-[11px] text-slate-500 mt-1 whitespace-pre-wrap break-words">
                            {item.note}
                          </div>
                        )}
                      </div>

                      {/* 発注状況 */}
                      <div className="shrink-0">
                        {canEdit ? (
                          <select
                            value={stepKey}
                            disabled={saving}
                            onChange={e =>
                              handleStatusChange(item, e.target.value as OrderStatus)
                            }
                            className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-black focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 ${statusBadge(norm)}`}
                          >
                            {STEPS.map(s => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-black ${statusBadge(norm)}`}
                          >
                            {ORDER_STATUS_LABELS[norm]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
