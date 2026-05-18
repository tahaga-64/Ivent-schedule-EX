import { useRef } from 'react';
import { useInView } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface VenueStat {
  venue: string;
  count: number;
  budget: number;
}

interface Props {
  data: VenueStat[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function VenueUtilizationChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const chartData = data.slice(0, 5).map(d => ({
    ...d,
    venue: d.venue.length > 10 ? d.venue.slice(0, 10) + '…' : d.venue,
  }));

  return (
    <div ref={ref}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="venue" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} width={80} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            formatter={(v) => [Number(v ?? 0), '開催回数'] as [number, string]}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={inView} animationDuration={1000}>
            {chartData.map((entry, i) => (
              <Cell key={entry.venue} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
