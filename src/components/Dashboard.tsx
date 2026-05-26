import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, Calendar, CheckCircle2, BarChart2 } from 'lucide-react';
import type { Event } from '../types';

interface Props {
  events: Event[];
}

const REGION_COLORS: Record<string, string> = {
  北海道: '#6366f1', 東北: '#8b5cf6', 関東: '#3b82f6', 中部: '#06b6d4',
  関西: '#10b981', 中国: '#f59e0b', 四国: '#f97316', 九州: '#ef4444',
  沖縄: '#ec4899',
};
const DEFAULT_COLOR = '#94a3b8';

function getColor(name: string, map: Record<string, string>) {
  return map[name] ?? DEFAULT_COLOR;
}

export default function Dashboard({ events }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const stats = useMemo(() => {
    const active = events.filter(e => !e.id.startsWith('__'));
    const thisMonthEvents = active.filter(e => e.start?.startsWith(thisMonth));
    const completed = active.filter(e => e.status === 'completed').length;
    const completionRate = active.length > 0 ? Math.round((completed / active.length) * 100) : 0;

    // By region
    const regionMap: Record<string, number> = {};
    active.forEach(e => {
      if (e.region) regionMap[e.region] = (regionMap[e.region] ?? 0) + 1;
    });
    const byRegion = Object.entries(regionMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // By type
    const typeMap: Record<string, number> = {};
    active.forEach(e => {
      if (e.type) typeMap[e.type] = (typeMap[e.type] ?? 0) + 1;
    });
    const byType = Object.entries(typeMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Monthly budget (last 6 months)
    const budgetMap: Record<string, number> = {};
    active.forEach(e => {
      if (e.prepBudgetTotal && e.start) {
        const month = e.start.slice(0, 7);
        budgetMap[month] = (budgetMap[month] ?? 0) + e.prepBudgetTotal;
      }
    });
    const monthKeys = Object.keys(budgetMap).sort().slice(-6);
    const byBudget = monthKeys.map(k => ({
      name: `${parseInt(k.slice(5))}月`,
      total: budgetMap[k],
    }));

    return { active, thisMonthEvents, completionRate, completed, byRegion, byType, byBudget };
  }, [events, thisMonth]);

  const summaryCards = [
    {
      label: '総イベント数',
      value: stats.active.length,
      sub: '全期間',
      icon: Calendar,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: '今月のイベント',
      value: stats.thisMonthEvents.length,
      sub: thisMonth.replace('-', '年') + '月',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: '完了率',
      value: `${stats.completionRate}%`,
      sub: `${stats.completed} 件完了`,
      icon: CheckCircle2,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <section className="mt-10 mb-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart2 size={16} className="text-indigo-600" />
        <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">ダッシュボード</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className={`inline-flex p-2 rounded-xl mb-3 ${card.bg}`}>
              <card.icon size={15} className={card.color} />
            </div>
            <div className="text-2xl font-black text-slate-800">{card.value}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-0.5">{card.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By region */}
        {stats.byRegion.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" style={{ color: '#1e293b' }}>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">地域別件数</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byRegion} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#1e293b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#1e293b' }} />
                <Tooltip
                  formatter={(v) => [`${v ?? 0} 件`, '件数']}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.byRegion.map(entry => (
                    <Cell key={entry.name} fill={getColor(entry.name, REGION_COLORS)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By type */}
        {stats.byType.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" style={{ color: '#1e293b' }}>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">種別件数</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byType} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#1e293b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#1e293b' }} />
                <Tooltip
                  formatter={(v) => [`${v ?? 0} 件`, '件数']}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Budget by month */}
        {stats.byBudget.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 lg:col-span-2" style={{ color: '#1e293b' }}>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">月別予算合計</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.byBudget} margin={{ top: 0, right: 8, left: 10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#1e293b' }} />
                <YAxis tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11, fill: '#1e293b' }} />
                <Tooltip
                  formatter={(v) => [`¥${Number(v ?? 0).toLocaleString()}`, '予算合計']}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
