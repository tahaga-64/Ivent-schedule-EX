import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { AnalyticsData } from '../../types';
import { formatCurrency } from '../../lib/analytics';

interface VenueUtilizationChartProps {
  data: AnalyticsData['topVenues'];
  className?: string;
}

export default function VenueUtilizationChart({ data, className = '' }: VenueUtilizationChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">データがありません</p>
      </div>
    );
  }

  // Top 10 venues for the bar chart
  const topVenues = data.slice(0, 10);
  
  // Cost efficiency data (budget per event)
  const efficiencyData = data.map(venue => ({
    venue: venue.venue.length > 15 ? venue.venue.substring(0, 15) + '...' : venue.venue,
    fullVenue: venue.venue,
    events: venue.count,
    costPerEvent: venue.count > 0 ? venue.budget / venue.count : 0,
    totalBudget: venue.budget
  }));

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          会場利用率・効率分析
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          会場別イベント数とコスト効率
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Venue Utilization */}
        <div>
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
            会場別イベント数（Top 10）
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVenues} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  type="category"
                  dataKey="venue"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  stroke="#9ca3af"
                  width={80}
                  tickFormatter={(value) => 
                    value.length > 12 ? value.substring(0, 12) + '...' : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number, name: string, props) => [
                    `${value}回`,
                    `${props.payload.venue}`
                  ]}
                  labelFormatter={() => ''}
                />
                <Bar 
                  dataKey="count" 
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Efficiency Analysis */}
        <div>
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
            コスト効率分析（イベント数 vs 1回あたりコスト）
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number"
                  dataKey="events"
                  name="イベント数"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  type="number"
                  dataKey="costPerEvent"
                  name="1回あたりコスト"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  stroke="#9ca3af"
                  tickFormatter={(value) => `¥${Math.round(value / 1000)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number, name: string, props) => {
                    if (name === 'costPerEvent') {
                      return [formatCurrency(value), '1回あたりコスト'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => 
                    payload && payload.length > 0 ? 
                      `会場: ${payload[0].payload.fullVenue}` : 
                      ''
                  }
                />
                <Scatter 
                  dataKey="costPerEvent" 
                  fill="#6366f1"
                  stroke="#4f46e5"
                  strokeWidth={1}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Venues Summary */}
      <div className="mt-6">
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
          主要会場サマリー
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topVenues.slice(0, 6).map((venue, index) => {
            const costPerEvent = venue.count > 0 ? venue.budget / venue.count : 0;
            return (
              <div 
                key={venue.venue}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                    {venue.venue}
                  </h5>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    #{index + 1}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">イベント数:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {venue.count}回
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">総予算:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(venue.budget)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">平均コスト:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(costPerEvent)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}