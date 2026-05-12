import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AnalyticsData } from '../../types';
import { formatCurrency } from '../../lib/analytics';

interface BudgetAnalysisChartProps {
  monthlyData: AnalyticsData['monthlyTrend'];
  regionData: AnalyticsData['topRegions'];
  totalBudget: number;
  className?: string;
}

const REGION_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
];

export default function BudgetAnalysisChart({ 
  monthlyData, 
  regionData, 
  totalBudget,
  className = '' 
}: BudgetAnalysisChartProps) {
  const formattedMonthlyData = monthlyData.map(item => ({
    ...item,
    monthLabel: new Date(item.month + '-01').toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'short' 
    })
  }));

  const pieData = regionData.slice(0, 6).map((region, index) => ({
    name: region.region,
    value: region.budget,
    color: REGION_COLORS[index]
  }));

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          予算分析
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          月別支出と地域別予算配分
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Budget Trend */}
        <div>
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
            月別予算推移
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  stroke="#9ca3af"
                  tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => [formatCurrency(value), '予算']}
                  labelFormatter={(label) => `月: ${label}`}
                />
                <Bar 
                  dataKey="budget" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Budget Distribution */}
        <div>
          <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
            地域別予算配分
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                  label={({ name, percent }) => 
                    percent > 5 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                  fontSize={10}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(totalBudget)}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400">
            総予算
          </div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {monthlyData.length > 0 ? 
              formatCurrency(monthlyData.reduce((sum, item) => sum + item.budget, 0) / monthlyData.length) :
              formatCurrency(0)
            }
          </div>
          <div className="text-xs text-green-600 dark:text-green-400">
            月平均
          </div>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {regionData.length > 0 ? regionData[0].region : 'N/A'}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400">
            最大支出地域
          </div>
        </div>
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {regionData.length}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400">
            活動地域数
          </div>
        </div>
      </div>
    </div>
  );
}