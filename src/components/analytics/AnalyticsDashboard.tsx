import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Calendar, MapPin, DollarSign, Award, Zap, BarChart2, ArrowUpRight, Users, Handshake, PercentCircle } from 'lucide-react';
import { AnalyticsData } from '../../types';
import { formatCurrencyCompact, formatNumber } from '../../lib/analytics';
import EventMetricsChart from '../charts/EventMetricsChart';
import BudgetAnalysisChart from '../charts/BudgetAnalysisChart';
import VenueUtilizationChart from '../charts/VenueUtilizationChart';
import CarrierInflowChart from '../charts/CarrierInflowChart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: AnalyticsData;
  loading: boolean;
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <ArrowUpRight size={14} className="text-slate-300" />
      </div>
      <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
      <div className="text-xs font-bold text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-black text-slate-800 tracking-tight">{title}</h3>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
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
}

export default function AnalyticsDashboard({ data, loading }: Props) {
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

  const maxRegionCount = Math.max(...data.regionStats.map(r => r.count), 1);

  const regionColors = [
    'bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500',
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
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

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Calendar size={18} className="text-indigo-600" />}
          label="総イベント数"
          value={String(data.totalEvents)}
          sub={`完了: ${data.completedEvents}`}
          color="bg-indigo-50"
          delay={0}
        />
        <KpiCard
          icon={<DollarSign size={18} className="text-emerald-600" />}
          label="総売上"
          value={formatCurrencyCompact(data.totalSales)}
          sub={`予算: ${formatCurrencyCompact(data.totalBudget)}`}
          color="bg-emerald-50"
          delay={0.05}
        />
        <KpiCard
          icon={<TrendingUp size={18} className="text-violet-600" />}
          label="総粗利"
          value={formatCurrencyCompact(data.totalGrossProfit)}
          sub={`平均予算: ${formatCurrencyCompact(data.avgBudget)}`}
          color="bg-violet-50"
          delay={0.1}
        />
        <KpiCard
          icon={<Users size={18} className="text-sky-600" />}
          label="来場数合計"
          value={formatNumber(data.totalAttendance)}
          sub={`稼働地域: ${data.activeRegions}`}
          color="bg-sky-50"
          delay={0.15}
        />
        <KpiCard
          icon={<MapPin size={18} className="text-rose-600" />}
          label="着座数"
          value={formatNumber(data.totalSeatedCount)}
          sub={`最多地域: ${data.topRegion || '—'}`}
          color="bg-rose-50"
          delay={0.2}
        />
        <KpiCard
          icon={<Handshake size={18} className="text-teal-600" />}
          label="成約数"
          value={formatNumber(data.totalContracts)}
          sub={`繁忙月: ${data.busiestMonth ? data.busiestMonth.replace('-', '年') + '月' : '—'}`}
          color="bg-teal-50"
          delay={0.25}
        />
        <KpiCard
          icon={<PercentCircle size={18} className="text-fuchsia-600" />}
          label="平均乗り換え率"
          value={`${data.avgCarrierSwitchRate.toFixed(1)}%`}
          sub="成約数 / 来場数"
          color="bg-fuchsia-50"
          delay={0.3}
        />
        <KpiCard
          icon={<Award size={18} className="text-amber-600" />}
          label="完了率"
          value={`${data.completionRate.toFixed(0)}%`}
          sub={`完了 ${data.completedEvents} / 全${data.totalEvents}`}
          color="bg-amber-50"
          delay={0.35}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="月別売上・粗利トレンド" sub="月ごとの売上と粗利の推移" />
          {data.monthlyTrends.length > 0 ? (
            <BudgetAnalysisChart data={data.monthlyTrends} />
          ) : (
            <EmptyChart />
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="月別 来場数・成約数" sub="来場の増減と成約の推移" />
          {data.monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                />
                <Line type="monotone" dataKey="attendance" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 2 }} name="来場数" />
                <Line type="monotone" dataKey="contracts" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} name="成約数" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="キャリア流入分析" sub="キャリア別の流入内訳" />
          <CarrierInflowChart data={data.carrierInflowTotal} />
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top venues */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
          animate={{ opacity: 1, y: 0 }}
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
          animate={{ opacity: 1, y: 0 }}
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

      {/* Analysis reports */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.43 }}
        className="bg-white rounded-2xl border border-slate-100 p-6"
      >
        <SectionHeader title="分析レポート" sub="最近作成されたイベント分析レポート" />
        {data.recentAnalysisReports.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.recentAnalysisReports.map((item) => (
              <div key={item.eventId} className="rounded-xl border border-slate-100 p-4 bg-slate-50/40">
                <p className="text-xs font-black text-slate-700">{item.venue}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.start}</p>
                <p className="text-sm font-bold text-slate-800 mt-2">{item.report.title}</p>
                <div className="mt-3 space-y-2">
                  <div className="bg-sky-50 border border-sky-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-black text-sky-700 uppercase tracking-wider">サマリー</p>
                    <p className="text-xs text-sky-800 mt-1 whitespace-pre-wrap">{item.report.summary || '記録なし'}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">良かった点</p>
                    <p className="text-xs text-emerald-800 mt-1 whitespace-pre-wrap">{item.report.goodPoints || '記録なし'}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">改善点</p>
                    <p className="text-xs text-amber-800 mt-1 whitespace-pre-wrap">{item.report.improvements || '記録なし'}</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-black text-violet-700 uppercase tracking-wider">次アクション</p>
                    <p className="text-xs text-violet-800 mt-1 whitespace-pre-wrap">{item.report.nextActions || '記録なし'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyChart />
        )}
      </motion.div>

      {/* Client stats */}
      {data.clientStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl border border-slate-100 p-6"
        >
          <SectionHeader title="クライアント別実績" sub="上位クライアントのイベント数・予算（既存）" />
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
