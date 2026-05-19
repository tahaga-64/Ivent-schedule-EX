import React, { memo, useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { TrendingUp, Calendar, MapPin, DollarSign, Award, Zap, BarChart2, ArrowUpRight, Users } from 'lucide-react';
import { AnalyticsData, Event } from '../../types';
import { formatCurrencyCompact } from '../../lib/analytics';
import EventMetricsChart from '../charts/EventMetricsChart';
import BudgetAnalysisChart from '../charts/BudgetAnalysisChart';
import VenueUtilizationChart from '../charts/VenueUtilizationChart';
import AttendanceHeatmap from '../charts/AttendanceHeatmap';

interface Props {
  data: AnalyticsData;
  loading: boolean;
  events?: Event[];
}

function useCountUp(target: number, inView: boolean, duration = 1200): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let rafId: number;
    let startTime: number | null = null;
    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(target * eased);
      if (progress < 1) rafId = requestAnimationFrame(tick);
      else setCount(target);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inView, target, duration]);
  return count;
}

const KpiCard = memo(function KpiCard({
  icon,
  label,
  sub,
  color,
  delay,
  rawValue,
  formatter,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  color: string;
  delay: number;
  rawValue: number;
  formatter: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const animatedValue = useCountUp(rawValue, inView);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <ArrowUpRight size={14} className="text-slate-300" />
      </div>
      <div className="text-2xl font-black text-slate-800 tracking-tight">
        {formatter(animatedValue)}
      </div>
      <div className="text-xs font-bold text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </motion.div>
  );
});

const SectionHeader = memo(function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-black text-slate-800 tracking-tight">{title}</h3>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
});

const ProgressBar = memo(function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
});

export default function AnalyticsDashboard({ data, loading, events = [] }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400">分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  const maxRegionCount = data.regionStats.length > 0 ? Math.max(...data.regionStats.map(r => r.count)) : 1;

  const regionColors = [
    'bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500',
  ];

  // Build dailyAttendance from events for heatmap
  const dailyAttendance = events
    .filter(e => e.start && e.attendance && e.attendance > 0)
    .map(e => ({ date: e.start!, attendance: e.attendance! }));

  return (
    <div className="space-y-8">
      {/* Row 0: Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart2 size={20} className="text-indigo-500" />
            パフォーマンス分析
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">イベント実績・予算・地域カバレッジの総合レポート</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
          <Zap size={12} className="text-indigo-500" />
          <span className="text-[11px] font-black text-indigo-600">リアルタイム更新</span>
        </div>
      </div>

      {/* Row 1: 8 KPI cards - 4 per row, 2 rows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Row A */}
        <KpiCard icon={<Calendar size={18} className="text-indigo-600"/>} label="総イベント数" rawValue={data.totalEvents} formatter={n => String(Math.round(n))} sub={`完了: ${data.completedEvents}`} color="bg-indigo-50" delay={0} />
        <KpiCard icon={<DollarSign size={18} className="text-emerald-600"/>} label="総売上" rawValue={data.totalSales} formatter={n => formatCurrencyCompact(n)} sub={`粗利: ${formatCurrencyCompact(data.totalGrossProfit)}`} color="bg-emerald-50" delay={0.05} />
        <KpiCard icon={<TrendingUp size={18} className="text-violet-600"/>} label="粗利" rawValue={data.totalGrossProfit} formatter={n => formatCurrencyCompact(n)} sub={data.totalSales > 0 ? `利益率 ${Math.round((data.totalGrossProfit/data.totalSales)*100)}%` : '—'} color="bg-violet-50" delay={0.1} />
        <KpiCard icon={<Users size={18} className="text-cyan-600"/>} label="来場数合計" rawValue={data.totalAttendance} formatter={n => Math.round(n).toLocaleString()} sub={`着座: ${data.totalSeatedCount.toLocaleString()}`} color="bg-cyan-50" delay={0.15} />
        {/* Row B */}
        <KpiCard icon={<MapPin size={18} className="text-orange-600"/>} label="着座数" rawValue={data.totalSeatedCount} formatter={n => Math.round(n).toLocaleString()} sub={data.totalAttendance > 0 ? `着座率 ${Math.round((data.totalSeatedCount/data.totalAttendance)*100)}%` : '—'} color="bg-orange-50" delay={0.2} />
        <KpiCard icon={<Award size={18} className="text-rose-600"/>} label="成約数" rawValue={data.totalContracts} formatter={n => Math.round(n).toLocaleString()} sub={data.totalAttendance > 0 ? `成約率 ${Math.round((data.totalContracts/data.totalAttendance)*100)}%` : '—'} color="bg-rose-50" delay={0.25} />
        <KpiCard icon={<Zap size={18} className="text-amber-600"/>} label="乗り換え率" rawValue={data.avgCarrierSwitchRate} formatter={n => `${n.toFixed(1)}%`} sub={`成約 ${data.totalContracts} / 来場 ${data.totalAttendance}`} color="bg-amber-50" delay={0.3} />
        <KpiCard icon={<BarChart2 size={18} className="text-slate-600"/>} label="完了率" rawValue={data.completionRate} formatter={n => `${n.toFixed(0)}%`} sub={`繁忙月: ${data.busiestMonth ? data.busiestMonth.replace('-', '年')+'月' : '—'}`} color="bg-slate-50" delay={0.35} />
      </div>

      {/* Row 2: Monthly trends - 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="月別イベント推移" sub="過去のイベント開催数のトレンド" />
          {data.monthlyTrends.length > 0 ? (
            <EventMetricsChart data={data.monthlyTrends} />
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="月別売上推移" sub="月ごとの累計予算の推移" />
          {data.monthlyTrends.length > 0 ? (
            <BudgetAnalysisChart data={data.monthlyTrends} />
          ) : (
            <EmptyChart />
          )}
        </motion.div>
      </div>

      {/* Row 3: Conversion funnel */}
      <div className="grid grid-cols-1 gap-6">
        <motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:0.4}} className="bg-white rounded-2xl border border-slate-100 p-6">
          <SectionHeader title="コンバージョンファネル" sub="来場 → 着座 → 成約の転換率" />
          <div className="space-y-5 mt-4">
            {[
              { label: '来場数', value: data.totalAttendance, pct: 100, color: 'bg-indigo-500' },
              { label: '着座数', value: data.totalSeatedCount, pct: data.totalAttendance > 0 ? Math.round((data.totalSeatedCount/data.totalAttendance)*100) : 0, color: 'bg-violet-500' },
              { label: '成約数', value: data.totalContracts, pct: data.totalAttendance > 0 ? Math.round((data.totalContracts/data.totalAttendance)*100) : 0, color: 'bg-emerald-500' },
            ].map(step => (
              <div key={step.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">{step.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-700">{step.value.toLocaleString()}</span>
                    <span className="text-[10px] font-black text-slate-400 w-9 text-right">{step.pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{width:0}} animate={{width:`${step.pct}%`}} transition={{duration:0.8,ease:'easeOut',delay:0.4}} className={`h-full rounded-full ${step.color}`} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Row 4: Attendance heatmap - full width */}
      {dailyAttendance.length > 0 && (
        <motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:0.5}} className="bg-white rounded-2xl border border-slate-100 p-6">
          <SectionHeader title="来場数ヒートマップ" sub="日別の来場者数の推移（過去52週）" />
          <AttendanceHeatmap dailyAttendance={dailyAttendance} />
        </motion.div>
      )}

      {/* Row 5: venues/regions/types - 3 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top venues */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 lg:col-span-1"
        >
          <SectionHeader title="人気会場 TOP5" sub="開催回数ランキング" />
          {data.topVenues.length > 0 ? (
            <VenueUtilizationChart data={data.topVenues} />
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        {/* Region breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="地域別実績" sub="各地域のイベント分布" />
          {data.regionStats.length > 0 ? (
            <div className="space-y-4">
              {data.regionStats.slice(0, 5).map((r, i) => (
                <div key={r.region}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${regionColors[i % regionColors.length]}`} />
                      <span className="text-xs font-bold text-slate-700">{r.region}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">{formatCurrencyCompact(r.budget)}</span>
                      <span className="text-xs font-black text-slate-700 w-8 text-right">{r.count}</span>
                    </div>
                  </div>
                  <ProgressBar value={r.count} max={maxRegionCount} color={regionColors[i % regionColors.length]} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        {/* Event type breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="種別分布" sub="イベントタイプ別の内訳" />
          {data.typeStats.length > 0 ? (
            <div className="space-y-3">
              {data.typeStats.slice(0, 6).map((t, i) => {
                const pct = data.totalEvents > 0 ? (t.count / data.totalEvents) * 100 : 0;
                return (
                  <div key={t.type} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-indigo-600">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-700 truncate">{t.type}</span>
                        <span className="text-xs font-black text-slate-400 ml-2">{t.count}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: 0.4 + i * 0.05 }}
                          className="h-full bg-indigo-400 rounded-full"
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 w-8 text-right shrink-0">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart />
          )}
        </motion.div>
      </div>

      {/* Row 7: Client table */}
      {data.clientStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="クライアント別実績" sub="上位クライアントのイベント数・予算" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3">クライアント</th>
                  <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3">件数</th>
                  <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3 hidden sm:table-cell">予算</th>
                  <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3">シェア</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.clientStats.map((c, i) => {
                  const pct = data.totalEvents > 0 ? (c.count / data.totalEvents) * 100 : 0;
                  return (
                    <tr key={c.client} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                            {i + 1}
                          </div>
                          <span className="text-sm font-bold text-slate-700">{c.client}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-sm font-black text-slate-700">{c.count}</span>
                      </td>
                      <td className="py-3 text-right hidden sm:table-cell">
                        <span className="text-sm font-bold text-slate-500">{formatCurrencyCompact(c.budget)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-black text-slate-400 w-8">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-40 flex items-center justify-center text-slate-300">
      <div className="text-center">
        <TrendingUp size={28} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs font-bold">データが不足しています</p>
      </div>
    </div>
  );
}
