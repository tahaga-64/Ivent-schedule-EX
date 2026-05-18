import { useRef } from 'react';
import { useInView } from 'motion/react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CarrierInflow } from '../../types';

interface Props {
  data: CarrierInflow;
}

const LABELS: Record<keyof CarrierInflow, string> = {
  docomo: 'docomo',
  au: 'au',
  softbank: 'softbank',
  rakuten: 'rakuten',
  other: 'other',
};

const COLORS: Record<keyof CarrierInflow, string> = {
  docomo: '#e60012',
  au: '#f60',
  softbank: '#cc0',
  rakuten: '#bf0000',
  other: '#94a3b8',
};

export default function CarrierInflowChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const chartData = (Object.keys(LABELS) as (keyof CarrierInflow)[])
    .map((key) => ({ name: LABELS[key], value: data[key] ?? 0, color: COLORS[key] }))
    .filter(d => d.value > 0);

  if (chartData.length === 0) {
    return <EmptyChart />;
  }

  return (
    <div ref={ref}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={54}
            outerRadius={82}
            paddingAngle={2}
            isAnimationActive={inView}
            animationDuration={1000}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
            formatter={(v) => [`${Number(v ?? 0).toLocaleString()}件`, '流入数'] as [string, string]}
          />
          <Legend verticalAlign="bottom" height={24} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center text-slate-300">
      <p className="text-xs font-bold">キャリア流入データがありません</p>
    </div>
  );
}
