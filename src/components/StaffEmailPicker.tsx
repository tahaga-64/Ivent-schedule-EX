import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Search } from 'lucide-react';
import type { StaffMember } from '../types';

export interface KnownUser {
  email: string;
  displayName: string;
}

interface Props {
  staff: StaffMember;
  /** ログイン実績のあるユーザー（userProfiles 由来）。email・displayName を連携に使う。 */
  knownUsers: KnownUser[];
  /** email を保存。空文字なら連携解除。 */
  onSave: (email: string) => void;
  onClose: () => void;
}

/**
 * スタッフ名に email を紐付けるピッカー。
 * メンバー追加通知は staff.email を宛先に使うため、ここで「名前 <-> email」を明示的に連携する。
 */
export default function StaffEmailPicker({ staff, knownUsers, onSave, onClose }: Props) {
  const [manual, setManual] = useState(staff.email ?? '');
  const [filter, setFilter] = useState('');

  // スタッフ名に近い表示名のユーザーを上位に並べる
  const sorted = [...knownUsers].sort((a, b) => {
    const aMatch = a.displayName?.includes(staff.name) || staff.name.includes(a.displayName ?? ' ');
    const bMatch = b.displayName?.includes(staff.name) || staff.name.includes(b.displayName ?? ' ');
    return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
  });
  const q = filter.trim().toLowerCase();
  const list = q
    ? sorted.filter(u => (u.displayName ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : sorted;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-black text-slate-900 truncate">「{staff.name}」のメール連携</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors" aria-label="閉じる">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">ログイン済みユーザーから選択</div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-2">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="名前・メールで絞り込み"
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none min-w-0"
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {list.length === 0 && (
                <div className="text-xs text-slate-400 py-3 text-center">
                  該当ユーザーなし（各自が一度ログインすると表示されます）
                </div>
              )}
              {list.map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => onSave(u.email)}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                    {(u.displayName || u.email)[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{u.displayName || '（名前未設定）'}</div>
                    <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                  </div>
                  {staff.email === u.email && <Check size={14} className="text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">または手入力</div>
            <input
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder="example@gmail.com"
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200">
          <button onClick={() => onSave('')} className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors">
            連携を解除
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              キャンセル
            </button>
            <button onClick={() => onSave(manual.trim())} className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
