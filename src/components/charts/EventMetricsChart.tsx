import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AnalyticsData } from '../../types';

interface EventMetricsChartProps {
  data: AnalyticsData['monthlyTrend'];
  className?: string;
}

export default function EventMetricsChart({ data, className = '' }: EventMetricsChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">データがありません</p>
      </div>
    );
  }

  const formattedData = data.map(item => ({
    ...item,
    monthLabel: new Date(item.month + '-01').toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'short' 
    })
  }));

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          月別イベント数推移
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          今年のイベント開催数の推移
        </p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="monthLabel" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              stroke="#9ca3af"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value: number, name: string) => [
                `${value}件`,
                name === 'events' ? 'イベント数' : name
              ]}
              labelFormatter={(label) => `月: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="events" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {data.reduce((sum, item) => sum + item.events, 0)}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            総イベント数
          </div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.events, 0) / data.length) : 0}
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">
            月平均
          </div>
        </div>
      </div>
    </div>
  );
}