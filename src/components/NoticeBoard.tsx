import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, Plus, Trash2, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { subscribeNoticesByDate, addNotice, deleteNotice, type Notice } from '../lib/notices';
import { notifyPush, isPushNotificationConfigured } from '../lib/pushNotifications';

interface Props {
  canEdit: boolean;
  user: User | null;
}

export default function NoticeBoard({ canEdit, user }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeNoticesByDate(today, list => {
      setNotices(list);
      setLoading(false);
    });
    return unsub;
  }, [today]);

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await addNotice(today, text, user ?? {});
      if (isPushNotificationConfigured()) {
        const author = user?.displayName || user?.email?.split('@')[0] || 'スタッフ';
        const preview = text.length > 60 ? text.slice(0, 60) + '…' : text;
        notifyPush({
          type: 'notice_added',
          title: '連絡事項が投稿されました',
          message: `${author}：${preview}`,
        });
      }
      setDraft('');
      setAdding(false);
    } catch (err) {
      console.error('連絡事項の追加に失敗:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotice(id);
    } catch (err) {
      console.error('連絡事項の削除に失敗:', err);
      alert('連絡事項の削除に失敗しました。通信状況を確認してもう一度お試しください。');
    }
  };

  if (loading) return null;

  return (
    <div className="tank-card rounded-2xl p-4 border border-amber-200/60 bg-amber-50/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone size={15} className="text-amber-600" />
          <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">連絡事項</span>
          {notices.length > 0 && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">{notices.length}</span>
          )}
        </div>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] font-black text-amber-700 hover:text-amber-900 transition-colors"
          >
            <Plus size={13} strokeWidth={3} />
            追加
          </button>
        )}
      </div>

      {/* 追加フォーム */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="本日の連絡事項を入力…"
              rows={2}
              autoFocus
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => { setAdding(false); setDraft(''); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X size={12} />
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={!draft.trim() || saving}
                className="px-4 py-1.5 rounded-lg text-[11px] font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中…' : '投稿'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 連絡事項リスト */}
      {loading ? (
        <div className="text-[11px] text-slate-400 py-2">読み込み中…</div>
      ) : notices.length === 0 ? (
        <div className="text-[11px] text-slate-400 py-2">本日の連絡事項はありません</div>
      ) : (
        <div className="space-y-2">
          {notices.map(n => (
            <div
              key={n.id}
              className="flex items-start gap-2 bg-white rounded-xl px-3 py-2.5 border border-amber-100"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
              <p className="flex-1 min-w-0 text-sm text-slate-800 font-medium whitespace-pre-wrap break-words">{n.content}</p>
              {canEdit && (
                <button
                  onClick={() => handleDelete(n.id)}
                  className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  title="削除"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
