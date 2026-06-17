import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { StaffMember } from '../types';

interface Props {
  staff: StaffMember;
  knownUsers: { email: string; displayName: string }[];
  onSave: (email: string) => void;
  onClose: () => void;
}

export default function StaffEmailPicker({ staff, knownUsers, onSave, onClose }: Props) {
  const [email, setEmail] = useState(staff.email ?? '');

  const handleSave = () => {
    onSave(email.trim());
  };

  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl shadow-2xl p-6 max-w-sm mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-slate-900">メールアドレスを設定</h2>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-4">{staff.name}</p>
          {knownUsers.length > 0 && (
            <div className="mb-3 space-y-1">
              {knownUsers.map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => setEmail(u.email)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition-colors ${
                    email === u.email
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-[11px] text-slate-400">{u.email}</div>
                </button>
              ))}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレスを入力..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              保存
            </button>
          </div>
        </motion.div>
      </>
    </AnimatePresence>,
    document.body,
  );
}
