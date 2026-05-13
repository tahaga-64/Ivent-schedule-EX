import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MonthlyTrend } from '../../types';

interface Props {
  data: MonthlyTrend[];
}

function formatMonth(ym: string): string {
  if (!ym) return '';
  const [, m] = ym.split('-');
  return `${parseInt(m)}月`;
}

function formatYen(v: number): string {
  if (v >= 1000000) return `¥${(v / 1000000).toFixed(1)}M`;
  if (v >= 10000) return `¥${(v / 10000).toFixed(0)}万`;
  return `¥${v.toLocaleString()}`;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export default function BudgetAnalysisChart({ data }: Props) {
  const chartData = data.map(d => ({ ...d, month: formatMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatYen} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          formatter={(v: any) => [formatYen(v), '予算合計']}
        />
        <Bar dataKey="budget" radius={[6, 6, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
