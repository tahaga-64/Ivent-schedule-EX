import { useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Download } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { Event, EventFinancials } from '../types';

const fmt = (n: number | undefined) =>
  n == null || isNaN(n) ? '—' : '¥' + Math.round(n).toLocaleString('ja-JP');

const pct = (profit: number, revenue: number) => {
  if (!revenue) return null;
  return Math.round((profit / revenue) * 100);
};

interface CostRow {
  key: keyof EventFinancials;
  estKey: keyof EventFinancials;
  actKey: keyof EventFinancials;
  label: string;
  icon: string;
  autoNote?: string;
}

const COST_ROWS: CostRow[] = [
  { key: 'estimatedStaffCost',      estKey: 'estimatedStaffCost',      actKey: 'actualStaffCost',      label: '人件費',     icon: '👤' },
  { key: 'estimatedOutsourceCost',  estKey: 'estimatedOutsourceCost',  actKey: 'actualOutsourceCost',  label: '外注費',     icon: '🤝' },
  { key: 'estimatedVenueCost',      estKey: 'estimatedVenueCost',      actKey: 'actualVenueCost',      label: '会場費',     icon: '🏢' },
  { key: 'estimatedTransportCost',  estKey: 'estimatedTransportCost',  actKey: 'actualTransportCost',  label: '交通費',     icon: '🚗' },
  { key: 'estimatedPrepCost',       estKey: 'estimatedPrepCost',       actKey: 'actualPrepCost',       label: '準備物費',   icon: '📦', autoNote: '準備物リストから自動反映' },
  { key: 'estimatedOtherCost',      estKey: 'estimatedOtherCost',      actKey: 'actualOtherCost',      label: 'その他',     icon: '💼' },
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

  const estCosts = COST_ROWS.reduce((s, r) => {
    const val = r.estKey === 'estimatedPrepCost' ? (f.estimatedPrepCost ?? prepBudget) : (f[r.estKey] as number | undefined);
    return s + (val ?? 0);
  }, 0);
  const actCosts = COST_ROWS.reduce((s, r) => {
    const val = r.actKey === 'actualPrepCost' ? (f.actualPrepCost ?? prepBudget) : (f[r.actKey] as number | undefined);
    return s + (val ?? 0);
  }, 0);

  const estRev = f.estimatedRevenue ?? 0;
  const actRev = f.actualRevenue ?? 0;
  const estProfit = estRev - estCosts;
  const actProfit = actRev - actCosts;
  const estPct = pct(estProfit, estRev);
  const actPct = pct(actProfit, actRev);

  const hasAnyData = estRev > 0 || actRev > 0;

  const handleExport = () => {
    const rows = [
      ['項目', '見積', '実績'],
      ['売上高', f.estimatedRevenue ?? '', f.actualRevenue ?? ''],
      [''],
      ['費用内訳', '', ''],
      ...COST_ROWS.map(r => {
        const est = r.estKey === 'estimatedPrepCost' ? (f.estimatedPrepCost ?? prepBudget) : (f[r.estKey] ?? '');
        const act = r.actKey === 'actualPrepCost' ? (f.actualPrepCost ?? prepBudget) : (f[r.actKey] ?? '');
        return [r.label, est, act];
      }),
      ['費用合計', estCosts || '', actCosts || ''],
      [''],
      ['粗利', estProfit || '', actProfit || ''],
      ['粗利率', estPct != null ? `${estPct}%` : '', actPct != null ? `${actPct}%` : ''],
      [''],
      ['メモ', f.memo ?? '', ''],
    ];
    const ws = utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '財務');
    writeFile(wb, `${event.venue}_財務.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* KPI サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="売上高（実績）" value={fmt(actRev || undefined)} sub={actRev ? undefined : '未入力'} color="indigo" />
        <KpiCard label="費用合計（実績）" value={fmt(actCosts || undefined)} sub={actCosts ? undefined : '未入力'} color="slate" />
        <KpiCard
          label="粗利（実績）"
          value={actRev ? fmt(actProfit) : '—'}
          sub={actPct != null ? `粗利率 ${actPct}%` : undefined}
          color={actProfit > 0 ? 'emerald' : actProfit < 0 ? 'red' : 'slate'}
          icon={actProfit > 0 ? <TrendingUp size={14} /> : actProfit < 0 ? <TrendingDown size={14} /> : null}
        />
        <KpiCard
          label="見積 vs 実績差"
          value={hasAnyData ? fmt(actProfit - estProfit) : '—'}
          sub={hasAnyData && estProfit !== 0 ? `見積粗利 ${fmt(estProfit)}` : undefined}
          color={actProfit >= estProfit ? 'emerald' : 'amber'}
        />
      </div>

      {/* 損益テーブル */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">損益内訳</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors"
          >
            <Download size={12} />
            Excel出力
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest w-[45%]">項目</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">見積</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">実績</th>
            </tr>
          </thead>
          <tbody>
            {/* 売上 */}
            <tr className="border-b border-slate-100 bg-indigo-50/40">
              <td className="px-4 py-3 font-black text-indigo-900 text-sm">💰 売上高</td>
              <td className="px-4 py-3 text-right">
                <NumberCell
                  value={f.estimatedRevenue}
                  canEdit={canEdit}
                  onChange={v => set('estimatedRevenue', v)}
                  highlight="indigo"
                />
              </td>
              <td className="px-4 py-3 text-right">
                <NumberCell
                  value={f.actualRevenue}
                  canEdit={canEdit}
                  onChange={v => set('actualRevenue', v)}
                  highlight="indigo"
                />
              </td>
            </tr>

            {/* 費用ヘッダ行 */}
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <td colSpan={3} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">費用内訳</td>
            </tr>

            {COST_ROWS.map((row, i) => {
              const estVal = row.estKey === 'estimatedPrepCost'
                ? (f.estimatedPrepCost ?? (prepBudget || undefined))
                : (f[row.estKey] as number | undefined);
              const actVal = row.actKey === 'actualPrepCost'
                ? (f.actualPrepCost ?? (prepBudget || undefined))
                : (f[row.actKey] as number | undefined);
              const isAuto = row.actKey === 'actualPrepCost' && prepBudget > 0 && f.actualPrepCost == null;
              return (
                <tr key={row.label} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{row.icon}</span>
                      <span>{row.label}</span>
                      {row.autoNote && prepBudget > 0 && (
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">自動</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <NumberCell
                      value={estVal}
                      canEdit={canEdit}
                      onChange={v => set(row.estKey, v)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <NumberCell
                      value={actVal}
                      canEdit={canEdit && !isAuto}
                      onChange={v => set(row.actKey, v)}
                      dimmed={isAuto}
                      autoLabel={isAuto ? '準備物リストから自動' : undefined}
                    />
                  </td>
                </tr>
              );
            })}

            {/* 費用合計 */}
            <tr className="border-b border-slate-200 bg-slate-100/70">
              <td className="px-4 py-3 font-black text-slate-800">費用合計</td>
              <td className="px-4 py-3 text-right font-black text-slate-700">{estCosts ? fmt(estCosts) : '—'}</td>
              <td className="px-4 py-3 text-right font-black text-slate-700">{actCosts ? fmt(actCosts) : '—'}</td>
            </tr>

            {/* 粗利 */}
            <tr className="border-b border-slate-100">
              <td className="px-4 py-3 font-black text-slate-800">粗利</td>
              <td className={`px-4 py-3 text-right font-black ${estProfitColor(estProfit, estRev)}`}>
                {estRev ? fmt(estProfit) : '—'}
              </td>
              <td className={`px-4 py-3 text-right font-black ${estProfitColor(actProfit, actRev)}`}>
                {actRev ? fmt(actProfit) : '—'}
              </td>
            </tr>

            {/* 粗利率 */}
            <tr className="bg-slate-50/40">
              <td className="px-4 py-3 font-black text-slate-800">粗利率</td>
              <td className={`px-4 py-3 text-right font-black ${estProfitColor(estProfit, estRev)}`}>
                {estPct != null ? `${estPct}%` : '—'}
              </td>
              <td className={`px-4 py-3 text-right font-black ${estProfitColor(actProfit, actRev)}`}>
                {actPct != null ? `${actPct}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* メモ */}
      <div>
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">財務メモ</label>
        {canEdit ? (
          <textarea
            value={f.memo ?? ''}
            onChange={e => onUpdate({ financials: { ...f, memo: e.target.value || undefined } })}
            rows={3}
            placeholder="見積根拠・特記事項・クライアント条件など"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white placeholder:text-slate-300"
          />
        ) : (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 min-h-[72px]">
            {f.memo || <span className="text-slate-300">メモなし</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function estProfitColor(profit: number, revenue: number): string {
  if (!revenue) return 'text-slate-400';
  if (profit > 0) return 'text-emerald-600';
  if (profit < 0) return 'text-red-600';
  return 'text-slate-500';
}

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: 'indigo' | 'emerald' | 'red' | 'slate' | 'amber';
  icon?: React.ReactNode;
}) {
  const colorMap = {
    indigo: 'from-indigo-50 to-indigo-100/60 border-indigo-200/70 text-indigo-700',
    emerald: 'from-emerald-50 to-emerald-100/60 border-emerald-200/70 text-emerald-700',
    red: 'from-red-50 to-red-100/60 border-red-200/70 text-red-700',
    slate: 'from-slate-50 to-slate-100/60 border-slate-200/70 text-slate-700',
    amber: 'from-amber-50 to-amber-100/60 border-amber-200/70 text-amber-700',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br px-4 py-3 ${colorMap[color]}`}>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        {icon && <span className="opacity-70">{icon}</span>}
        <div className="text-lg font-black leading-tight">{value}</div>
      </div>
      {sub && <div className="text-[10px] font-bold opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function NumberCell({
  value, canEdit, onChange, highlight, dimmed, autoLabel,
}: {
  value: number | undefined;
  canEdit: boolean;
  onChange: (v: string) => void;
  highlight?: 'indigo';
  dimmed?: boolean;
  autoLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canEdit || dimmed) {
    return (
      <div className={`text-sm font-bold ${dimmed ? 'text-slate-400 italic text-xs' : highlight ? 'text-indigo-700' : 'text-slate-700'}`}>
        {autoLabel ? (
          <span className="text-[10px] text-slate-400">{value != null ? fmt(value) : '—'}</span>
        ) : (
          fmt(value)
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
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
      className={`w-full text-right rounded-lg border px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 transition-all bg-white
        ${highlight
          ? 'border-indigo-200 text-indigo-700 focus:ring-indigo-300'
          : 'border-slate-200 text-slate-700 focus:ring-indigo-200'
        }`}
    />
  );
}
