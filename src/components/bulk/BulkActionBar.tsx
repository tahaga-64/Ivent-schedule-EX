import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Edit, Download, X, Loader2, CheckSquare } from 'lucide-react';
import { Event } from '../../types';
import { batchManager } from '../../lib/batchOperations';

interface BulkActionBarProps {
  selectedEventIds: string[];
  events: Event[];
  onClearSelection: () => void;
  onBulkUpdate: () => void;
  className?: string;
}

interface BulkUpdateModalProps {
  selectedEventIds: string[];
  onClose: () => void;
  onUpdate: (updates: Partial<Event>) => void;
  isUpdating: boolean;
}

function BulkUpdateModal({ selectedEventIds, onClose, onUpdate, isUpdating }: BulkUpdateModalProps) {
  const [updates, setUpdates] = useState<Partial<Event>>({
    region: '',
    type: '',
    client: ''
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty values
    const filteredUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value && value.trim() !== '') {
        acc[key as keyof Event] = value;
      }
      return acc;
    }, {} as Partial<Event>);

    if (Object.keys(filteredUpdates).length === 0) {
      return;
    }

    onUpdate(filteredUpdates);
  }, [updates, onUpdate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              一括更新 ({selectedEventIds.length}件)
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                地域 (空白の場合は変更なし)
              </label>
              <input
                type="text"
                value={updates.region || ''}
                onChange={(e) => setUpdates(prev => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="地域名を入力"
                disabled={isUpdating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                タイプ (空白の場合は変更なし)
              </label>
              <input
                type="text"
                value={updates.type || ''}
                onChange={(e) => setUpdates(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="タイプ名を入力"
                disabled={isUpdating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                クライアント (空白の場合は変更なし)
              </label>
              <input
                type="text"
                value={updates.client || ''}
                onChange={(e) => setUpdates(prev => ({ ...prev, client: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="クライアント名を入力"
                disabled={isUpdating}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium transition-colors"
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <CheckSquare size={16} />
                    更新する
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                disabled={isUpdating}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function BulkActionBar({ 
  selectedEventIds, 
  events, 
  onClearSelection, 
  onBulkUpdate,
  className = '' 
}: BulkActionBarProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedEventIds.length;

  const handleBulkDelete = useCallback(async () => {
    const confirmMessage = `選択した${selectedCount}件のイベントを削除しますか？この操作は取り消せません。`;
    if (!confirm(confirmMessage)) return;

    setIsProcessing(true);
    setError(null);

    try {
      await batchManager.bulkDeleteEvents(selectedEventIds);
      onClearSelection();
      onBulkUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedEventIds, selectedCount, onClearSelection, onBulkUpdate]);

  const handleBulkUpdate = useCallback(async (updates: Partial<Event>) => {
    setIsProcessing(true);
    setError(null);

    try {
      await batchManager.bulkUpdateEvents(selectedEventIds, updates);
      setShowUpdateModal(false);
      onClearSelection();
      onBulkUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedEventIds, onClearSelection, onBulkUpdate]);

  const handleBulkExport = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await batchManager.exportEvents(selectedEventIds, events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エクスポートに失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedEventIds, events]);

  return (
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 ${className}`}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare size={20} className="text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedCount}件選択中
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    <Edit size={16} />
                    更新
                  </button>

                  <button
                    onClick={handleBulkExport}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    エクスポート
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    削除
                  </button>

                  <button
                    onClick={onClearSelection}
                    disabled={isProcessing}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpdateModal && (
          <BulkUpdateModal
            selectedEventIds={selectedEventIds}
            onClose={() => setShowUpdateModal(false)}
            onUpdate={handleBulkUpdate}
            isUpdating={isProcessing}
          />
        )}
      </AnimatePresence>
    </>
  );
}