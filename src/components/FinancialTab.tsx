import { Download } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { Event, EventFinancials } from '../types';

// ── 表示ヘルパー ─────────────────────────────────────────────────────────────

const fmt = (n: number | undefined) =>
  n == null || isNaN(n) ? '—' : '¥' + Math.round(n).toLocaleString('ja-JP');

const pct = (profit: number, revenue: number) => {
  if (!revenue) return null;
  return Math.round((profit / revenue) * 100);
};

// 経理の慣習に合わせ、黒字は黒・赤字のみ赤で表示する
function profitColor(profit: number, revenue: number): string {
  if (!revenue) return 'text-slate-400';
  if (profit < 0) return 'text-red-600';
  return 'text-slate-800';
}

interface CostRow {
  estKey: keyof EventFinancials;
  actKey: keyof EventFinancials;
  label: string;
  autoNote?: string;
}

const COST_ROWS: CostRow[] = [
  { estKey: 'estimatedStaffCost',     actKey: 'actualStaffCost',     label: '人件費' },
  { estKey: 'estimatedOutsourceCost', actKey: 'actualOutsourceCost', label: '外注費' },
  { estKey: 'estimatedVenueCost',     actKey: 'actualVenueCost',     label: '会場費' },
  { estKey: 'estimatedTransportCost', actKey: 'actualTransportCost', label: '交通費' },
  { estKey: 'estimatedPrepCost',      actKey: 'actualPrepCost',      label: '準備物費', autoNote: '準備物リストから自動反映' },
  { estKey: 'estimatedOtherCost',     actKey: 'actualOtherCost',     label: 'その他' },
];

interface Props {
  event: Event;
  canEdit: boolean;
  onUpdate: (updates: Partial<Event>) => void;
}

export default function FinancialTab({ event, canEdit, onUpdate }: Props) {
  const f: EventFinancials = event.financials ?? {};
  const prepBudget = event.prepBudgetTotal ?? 0;

  const set = (key: keyof EventFinancials, raw: string) => {
    const num = raw === '' ? undefined : parseFloat(raw.replace(/,/g, ''));
    onUpdate({ financials: { ...f, [key]: isNaN(num as number) ? undefined : num } });
  };

  // 行ごとの値を先に確定（デスクトップのテーブルとモバイルの縦積みで共用）
  const rows = COST_ROWS.map(row => {
    const estVal = row.estKey === 'estimatedPrepCost'
      ? (f.estimatedPrepCost ?? (prepBudget || undefined))
      : (f[row.estKey] as number | undefined);
    const actVal = row.actKey === 'actualPrepCost'
      ? (f.actualPrepCost ?? (prepBudget || undefined))
      : (f[row.actKey] as number | undefined);
    const isAuto = row.actKey === 'actualPrepCost' && prepBudget > 0 && f.actualPrepCost == null;
    return { ...row, estVal, actVal, isAuto };
  });

  const estCosts = rows.reduce((s, r) => s + (r.estVal ?? 0), 0);
  const actCosts = rows.reduce((s, r) => s + (r.actVal ?? 0), 0);

  const estRev = f.estimatedRevenue ?? 0;
  const actRev = f.actualRevenue ?? 0;
  const estProfit = estRev - estCosts;
  const actProfit = actRev - actCosts;
  const estPct = pct(estProfit, estRev);
  const actPct = pct(actProfit, actRev);

  const handleExport = () => {
    const exportRows = [
      ['項目', '見積', '実績'],
      ['売上高', f.estimatedRevenue ?? '', f.actualRevenue ?? ''],
      [''],
      ['費用内訳', '', ''],
      ...rows.map(r => [r.label, r.estVal ?? '', r.actVal ?? '']),
      ['費用合計', estCosts || '', actCosts || ''],
      [''],
      ['粗利', estProfit || '', actProfit || ''],
      ['粗利率', estPct != null ? `${estPct}%` : '', actPct != null ? `${actPct}%` : ''],
      [''],
      ['メモ', f.memo ?? '', ''],
    ];
    const ws = utils.aoa_to_sheet(exportRows);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '財務');
    writeFile(wb, `${event.venue}_財務.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* 損益内訳 */}
      <div className="rounded border border-slate-300 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-300 bg-slate-50">
          <span className="text-sm font-medium text-slate-700">損益内訳（見積 / 実績）</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs"
          >
            <Download size={12} />
            Excel出力
          </button>
        </div>

        {/* デスクトップ: 3列テーブル */}
        <table className="w-full text-sm hidden sm:table">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 w-[44%]">項目</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">見積</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">実績</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-4 py-2.5 text-slate-800">売上高</td>
              <td className="px-4 py-2.5 text-right">
                <NumberCell value={f.estimatedRevenue} canEdit={canEdit} onChange={v => set('estimatedRevenue', v)} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <NumberCell value={f.actualRevenue} canEdit={canEdit} onChange={v => set('actualRevenue', v)} />
              </td>
            </tr>

            <tr className="border-b border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-4 py-1.5 text-xs text-slate-500">費用内訳</td>
            </tr>

            {rows.map(row => (
              <tr key={row.label} className="border-b border-slate-200">
                <td className="px-4 py-2 text-slate-700">
                  {row.label}
                  {row.isAuto && <span className="ml-2 text-xs text-slate-400">{row.autoNote}</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  <NumberCell value={row.estVal} canEdit={canEdit} onChange={v => set(row.estKey, v)} />
                </td>
                <td className="px-4 py-2 text-right">
                  <NumberCell
                    value={row.actVal}
                    canEdit={canEdit && !row.isAuto}
                    onChange={v => set(row.actKey, v)}
                    dimmed={row.isAuto}
                  />
                </td>
              </tr>
            ))}

            <tr className="border-b border-slate-300 bg-slate-50">
              <td className="px-4 py-2.5 font-bold text-slate-800">費用合計</td>
              <td className="px-4 py-2.5 text-right font-bold text-slate-800 tabular-nums">{estCosts ? fmt(estCosts) : '—'}</td>
              <td className="px-4 py-2.5 text-right font-bold text-slate-800 tabular-nums">{actCosts ? fmt(actCosts) : '—'}</td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="px-4 py-2.5 font-bold text-slate-800">粗利</td>
              <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${profitColor(estProfit, estRev)}`}>
                {estRev ? fmt(estProfit) : '—'}
              </td>
              <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${profitColor(actProfit, actRev)}`}>
                {actRev ? fmt(actProfit) : '—'}
              </td>
            </tr>

            <tr>
              <td className="px-4 py-2.5 text-slate-700">粗利率</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${profitColor(estProfit, estRev)}`}>
                {estPct != null ? `${estPct}%` : '—'}
              </td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${profitColor(actProfit, actRev)}`}>
                {actPct != null ? `${actPct}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* モバイル: 項目ごとの縦積み（見積 / 実績 を横並び） */}
        <div className="sm:hidden divide-y divide-slate-200">
          <MobileRow
            label="売上高"
            est={<NumberCell value={f.estimatedRevenue} canEdit={canEdit} onChange={v => set('estimatedRevenue', v)} />}
            act={<NumberCell value={f.actualRevenue} canEdit={canEdit} onChange={v => set('actualRevenue', v)} />}
          />
          {rows.map(row => (
            <MobileRow
              key={row.label}
              label={row.label}
              note={row.isAuto ? row.autoNote : undefined}
              est={<NumberCell value={row.estVal} canEdit={canEdit} onChange={v => set(row.estKey, v)} />}
              act={
                <NumberCell
                  value={row.actVal}
                  canEdit={canEdit && !row.isAuto}
                  onChange={v => set(row.actKey, v)}
                  dimmed={row.isAuto}
                />
              }
            />
          ))}
          <MobileTotal
            label="費用合計"
            est={estCosts ? fmt(estCosts) : '—'}
            act={actCosts ? fmt(actCosts) : '—'}
          />
          <MobileTotal
            label="粗利"
            est={estRev ? fmt(estProfit) : '—'}
            act={actRev ? fmt(actProfit) : '—'}
            estClass={profitColor(estProfit, estRev)}
            actClass={profitColor(actProfit, actRev)}
          />
          <MobileTotal
            label="粗利率"
            est={estPct != null ? `${estPct}%` : '—'}
            act={actPct != null ? `${actPct}%` : '—'}
            estClass={profitColor(estProfit, estRev)}
            actClass={profitColor(actProfit, actRev)}
          />
        </div>
      </div>

      {/* メモ */}
      <div>
        <label className="text-xs text-slate-500 block mb-1.5">財務メモ</label>
        {canEdit ? (
          <textarea
            value={f.memo ?? ''}
            onChange={e => onUpdate({ financials: { ...f, memo: e.target.value || undefined } })}
            rows={3}
            placeholder="見積根拠・特記事項・クライアント条件など"
            style={{ fontSize: 16 }}
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-slate-700 resize-none focus:outline-none focus:border-slate-500 bg-white placeholder:text-slate-300"
          />
        ) : (
          <p className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-2.5 min-h-[72px] whitespace-pre-wrap">
            {f.memo || <span className="text-slate-300">メモなし</span>}
          </p>
        )}
      </div>
    </div>
  );
}

// ── モバイル用の行 ───────────────────────────────────────────────────────────

function MobileRow({ label, note, est, act }: {
  label: string;
  note?: string;
  est: React.ReactNode;
  act: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-sm text-slate-700">
        {label}
        {note && <span className="ml-2 text-xs text-slate-400">{note}</span>}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">見積</div>
          {est}
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">実績</div>
          {act}
        </div>
      </div>
    </div>
  );
}

function MobileTotal({ label, est, act, estClass = 'text-slate-800', actClass = 'text-slate-800' }: {
  label: string;
  est: string;
  act: string;
  estClass?: string;
  actClass?: string;
}) {
  return (
    <div className="px-4 py-2.5 bg-slate-50">
      <div className="text-sm font-bold text-slate-800">{label}</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">見積</div>
          <div className={`text-sm font-bold tabular-nums ${estClass}`}>{est}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">実績</div>
          <div className={`text-sm font-bold tabular-nums ${actClass}`}>{act}</div>
        </div>
      </div>
    </div>
  );
}

// ── 数値セル（onBlur / Enter / Tab で確定） ─────────────────────────────────

function NumberCell({ value, canEdit, onChange, dimmed }: {
  value: number | undefined;
  canEdit: boolean;
  onChange: (v: string) => void;
  dimmed?: boolean;
}) {
  if (!canEdit || dimmed) {
    return (
      <div className={`text-sm tabular-nums ${dimmed ? 'text-slate-400' : 'text-slate-700'}`}>
        {fmt(value)}
      </div>
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      defaultValue={value != null ? String(Math.round(value)) : ''}
      onBlur={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          onChange((e.target as HTMLInputElement).value);
        }
      }}
      placeholder="0"
      style={{ fontSize: 16 }}
      className="w-full text-right rounded border border-slate-300 px-2 py-1.5 text-slate-700 tabular-nums focus:outline-none focus:border-slate-500 bg-white"
    />
  );
}
