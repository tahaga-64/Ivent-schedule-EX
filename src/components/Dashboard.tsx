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
  北海道: '#007AFF', 東北: '#5856D6', 関東: '#34C759', 中部: '#FF9500',
  関西: '#FF2D55', 中国: '#AF52DE', 四国: '#5AC8FA', 九州: '#FF3B30',
  沖縄: '#30B0C7',
};
const DEFAULT_COLOR = '#8E8E93';

function getColor(name: string, map: Record<string, string>) {
  return map[name] ?? DEFAULT_COLOR;
}

export default function Dashboard({ events }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const stats = useMemo(() => {
    const active = events.filter(e => !e.id.startsWith('__'));
    const thisMonthEvents = active.filter(e => e.start.startsWith(thisMonth));
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
      color: 'text-[#007AFF]',
      bg: 'bg-[#007AFF]/10',
    },
    {
      label: '今月のイベント',
      value: stats.thisMonthEvents.length,
      sub: thisMonth.replace('-', '年') + '月',
      icon: TrendingUp,
      color: 'text-[#34C759]',
      bg: 'bg-[#34C759]/10',
    },
    {
      label: '完了率',
      value: `${stats.completionRate}%`,
      sub: `${stats.completed} 件完了`,
      icon: CheckCircle2,
      color: 'text-[#AF52DE]',
      bg: 'bg-[#AF52DE]/10',
    },
  ];

  return (
    <section className="mt-8 mb-6">
      <div className="flex items-center gap-2 mb-5 px-1">
        <BarChart2 size={18} className="text-[#007AFF]" />
        <h2 className="text-[17px] font-semibold text-black">ダッシュボード</h2>
      </div>

      {/* Summary cards - Apple style */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4">
            <div className={`inline-flex p-2.5 rounded-xl mb-3 ${card.bg}`}>
              <card.icon size={18} className={card.color} />
            </div>
            <div className="text-[28px] font-bold text-black leading-tight">{card.value}</div>
            <div className="text-[13px] font-medium text-[#8E8E93] mt-1">{card.label}</div>
            <div className="text-[11px] text-[#C7C7CC] mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By region */}
        {stats.byRegion.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
            <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-4">地域別件数</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byRegion} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 500 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v ?? 0} 件`, '件数']}
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
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
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
            <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-4">種別件数</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.byType} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 500 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v ?? 0} 件`, '件数']}
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#007AFF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Budget by month */}
        {stats.byBudget.length > 0 && (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 lg:col-span-2">
            <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-4">月別予算合計</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.byBudget} margin={{ top: 0, right: 8, left: 10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 500 }} />
                <YAxis tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`¥${Number(v ?? 0).toLocaleString()}`, '予算合計']}
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#34C759" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
