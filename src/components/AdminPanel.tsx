import { useState } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserPlus, Trash2, Shield, ShieldOff, ChevronDown } from 'lucide-react';
import type { RoleEntry, UserRole } from '../hooks/useRoles';
import { SUPER_ADMIN } from '../hooks/useRoles';

interface Props {
  roles: RoleEntry[];
  onAddUser: (email: string, displayName: string, role: UserRole) => Promise<void>;
  onUpdateRole: (email: string, role: UserRole) => Promise<void>;
  onRemoveUser: (email: string) => Promise<void>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  event_editor: 'イベント編集者',
  viewer: '閲覧のみ',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  event_editor: 'bg-indigo-100 text-indigo-700',
  viewer: 'bg-slate-100 text-slate-600',
};

export default function AdminPanel({ roles, onAddUser, onUpdateRole, onRemoveUser }: Props) {
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setAddError('有効なメールアドレスを入力してください');
      return;
    }
    if (roles.find(r => r.email === email)) {
      setAddError('このメールアドレスはすでに登録されています');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await Promise.all([
        onAddUser(email, newDisplayName.trim(), newRole),
        setDoc(doc(db, 'allowedUsers', email), { email, addedAt: serverTimestamp() }),
      ]);
      setNewEmail('');
      setNewDisplayName('');
      setNewRole('viewer');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '追加に失敗しました');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`${email} を削除しますか？\nこのユーザーはアプリにログインできなくなります。`)) return;
    try {
      await Promise.all([
        onRemoveUser(email),
        deleteDoc(doc(db, 'allowedUsers', email)),
      ]);
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  const handleRoleChange = async (email: string, role: UserRole) => {
    try {
      await onUpdateRole(email, role);
    } catch (e) {
      alert(e instanceof Error ? e.message : '変更に失敗しました');
    } finally {
      setEditingEmail(null);
    }
  };

  return (
    <section className="mt-10 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-purple-600" />
        <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">管理者設定</h2>
        <span className="text-[10px] text-slate-400 font-mono ml-1">ADMIN ONLY</span>
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ユーザー一覧</span>
          <span className="text-[10px] text-slate-400">({roles.length} 名)</span>
        </div>
        <div className="divide-y divide-slate-50">
          {roles.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">ユーザーがいません</div>
          )}
          {roles.map(entry => (
            <div key={entry.email} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 truncate">
                  {entry.displayName || <span className="text-slate-400 italic">名前未設定</span>}
                </div>
                <div className="text-xs text-slate-400 truncate">{entry.email}</div>
              </div>

              {editingEmail === entry.email ? (
                <div className="flex items-center gap-1.5">
                  {(['admin', 'event_editor', 'viewer'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(entry.email, r)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-colors ${
                        entry.role === r
                          ? ROLE_COLORS[r]
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                  <button
                    onClick={() => setEditingEmail(null)}
                    className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditingEmail(entry.email)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 ${ROLE_COLORS[entry.role]}`}
                  >
                    {ROLE_LABELS[entry.role]}
                    <ChevronDown size={10} />
                  </button>
                  {entry.email !== SUPER_ADMIN && (
                    <button
                      onClick={() => handleRemove(entry.email)}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {entry.email === SUPER_ADMIN && (
                    <span className="p-1.5 text-purple-300">
                      <ShieldOff size={13} />
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add user form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">ユーザーを追加</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setAddError(null); }}
            placeholder="メールアドレス"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
          />
          <input
            type="text"
            value={newDisplayName}
            onChange={e => setNewDisplayName(e.target.value)}
            placeholder="表示名（任意）"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white transition"
          >
            <option value="viewer">閲覧のみ</option>
            <option value="event_editor">イベント編集者</option>
            <option value="admin">管理者</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={adding || !newEmail.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition disabled:opacity-50 shrink-0"
          >
            <UserPlus size={14} />
            {adding ? '追加中...' : '追加'}
          </button>
        </div>
        {addError && (
          <p className="mt-2 text-xs text-red-600 font-bold">{addError}</p>
        )}
      </div>
    </section>
  );
}
