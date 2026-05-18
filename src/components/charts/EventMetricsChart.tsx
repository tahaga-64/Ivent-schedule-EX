import { useRef } from 'react';
import { useInView } from 'motion/react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { MonthlyTrend } from '../../types';

interface Props {
  data: MonthlyTrend[];
}

function formatMonth(ym: string): string {
  if (!ym) return '';
  const [, m] = ym.split('-');
  return `${parseInt(m)}月`;
}

export default function EventMetricsChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const chartData = data.map(d => ({ ...d, month: formatMonth(d.month) }));

  return (
    <div ref={ref}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            formatter={(v) => [Number(v ?? 0), 'イベント数'] as [number, string]}
          />
          <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorCount)" dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }} activeDot={{ r: 5 }} isAnimationActive={inView} animationDuration={1000} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
