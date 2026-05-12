import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../../hooks/useNotifications';
import { getNotificationIcon, getNotificationColor, getNotificationTime } from '../../lib/notifications';
import { Notification as AppNotification } from '../../types';

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visible: AppNotification[] = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="font-black text-sm text-slate-800">通知</div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  {(['all', 'unread'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors
                        ${filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                    >
                      {f === 'all' ? 'すべて' : '未読'}
                    </button>
                  ))}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <CheckCheck size={12} />
                    全既読
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Bell size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold">通知はありません</p>
                </div>
              ) : (
                visible.map(n => (
                  <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({ notification: n, onRead }: { notification: AppNotification; onRead: (id: string) => void | Promise<void> }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-start gap-3 ${!n.read ? 'bg-indigo-50/40' : ''}`}
      onClick={() => !n.read && onRead(n.id)}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${getNotificationColor(n.type)}`}>
        {getNotificationIcon(n.type)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
          <span className="text-[10px] text-slate-400 shrink-0">{getNotificationTime(n.createdAt)}</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
      </div>
      {!n.read && (
        <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1" />
      )}
    </motion.div>
  );
}
