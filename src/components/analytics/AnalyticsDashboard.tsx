import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, MapPin, Target, Calendar, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/analytics';
import EventMetricsChart from '../charts/EventMetricsChart';
import BudgetAnalysisChart from '../charts/BudgetAnalysisChart';
import VenueUtilizationChart from '../charts/VenueUtilizationChart';

interface AnalyticsDashboardProps {
  className?: string;
}

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const { analyticsData, isLoading, error, refreshData } = useAnalytics();

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] ${className}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400">分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] ${className}`}>
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-6xl">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            データ読み込みエラー
          </h3>
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const {
    eventCount,
    totalBudget,
    completedEvents,
    avgBudgetPerEvent,
    topVenues,
    topRegions,
    monthlyTrend,
    preparationEfficiency
  } = analyticsData;

  const currentYear = new Date().getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            分析ダッシュボード
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {currentYear}年のイベント運営パフォーマンス
          </p>
        </div>
        <button
          onClick={refreshData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <TrendingUp size={16} />
          更新
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatNumber(eventCount)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                総イベント数
              </div>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-green-600 dark:text-green-400 text-sm font-medium">
              完了: {formatNumber(completedEvents)}件
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalBudget)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                総予算
              </div>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
              平均: {formatCurrency(avgBudgetPerEvent)}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatPercent(preparationEfficiency.completionRate)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                準備完了率
              </div>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-orange-600 dark:text-orange-400 text-sm font-medium">
              オンタイム: {formatPercent(preparationEfficiency.onTimeRate)}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatNumber(preparationEfficiency.avgLeadTime)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                平均準備期間（日）
              </div>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">
              活動地域: {topRegions.length}箇所
            </span>
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <EventMetricsChart data={monthlyTrend} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <BudgetAnalysisChart 
            monthlyData={monthlyTrend}
            regionData={topRegions}
            totalBudget={totalBudget}
          />
        </motion.div>
      </div>

      {/* Venue Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <VenueUtilizationChart data={topVenues} />
      </motion.div>

      {/* Quick Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          インサイト
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
              最も活用されている会場
            </h4>
            <p className="text-blue-600 dark:text-blue-300 text-lg font-bold">
              {topVenues.length > 0 ? topVenues[0].venue : 'データなし'}
            </p>
            <p className="text-blue-500 dark:text-blue-400 text-sm">
              {topVenues.length > 0 ? `${topVenues[0].count}回開催` : ''}
            </p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="font-semibold text-green-800 dark:text-green-200 text-sm">
              最大予算地域
            </h4>
            <p className="text-green-600 dark:text-green-300 text-lg font-bold">
              {topRegions.length > 0 ? topRegions[0].region : 'データなし'}
            </p>
            <p className="text-green-500 dark:text-green-400 text-sm">
              {topRegions.length > 0 ? formatCurrency(topRegions[0].budget) : ''}
            </p>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 text-sm">
              月別傾向
            </h4>
            <p className="text-purple-600 dark:text-purple-300 text-lg font-bold">
              {monthlyTrend.length > 0 ? 
                (monthlyTrend.reduce((prev, curr) => prev.events > curr.events ? prev : curr).month.split('-')[1] + '月') :
                'データなし'
              }
            </p>
            <p className="text-purple-500 dark:text-purple-400 text-sm">
              最も活発な月
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}