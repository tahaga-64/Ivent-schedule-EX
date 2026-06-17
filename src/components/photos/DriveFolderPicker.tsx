import { useState, useEffect, useCallback } from 'react';
import { Folder, FolderPlus, Loader2, ChevronRight, ExternalLink } from 'lucide-react';
import { createDriveFolder, GOOGLE_DRIVE_FOLDER_URL, listDriveFolders, type DriveFolder } from '../../lib/photoStorage';

interface Props {
  selectedId: string | null;
  onSelect: (folderId: string, folderName: string) => void;
  disabled?: boolean;
}

export default function DriveFolderPicker({ selectedId, onSelect, disabled }: Props) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadFolders = useCallback(async (pid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDriveFolders(pid);
      setParentId(data.parentId);
      setFolders(data.folders);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  async function handleCreateFolder() {
    if (!newFolderName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createDriveFolder(newFolderName.trim(), parentId ?? undefined);
      setNewFolderName('');
      await loadFolders(parentId ?? undefined);
      onSelect(created.id, created.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">保存先フォルダ（Google Drive）</p>
        <a
          href={GOOGLE_DRIVE_FOLDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
        >
          <ExternalLink size={12} />
          Driveで開く
        </a>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-xs font-bold">フォルダを読み込み中...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </div>
      ) : folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          サブフォルダがありません。下の「＋フォルダ」で作成してください。
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {folders.map(folder => (
            <button
              key={folder.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(folder.id, folder.name)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                selectedId === folder.id
                  ? 'bg-indigo-50 text-indigo-800'
                  : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <Folder size={18} className={selectedId === folder.id ? 'text-indigo-600' : 'text-amber-500'} />
              <span className="flex-1 text-sm font-bold truncate">{folder.name}</span>
              {selectedId === folder.id && (
                <ChevronRight size={16} className="text-indigo-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleCreateFolder(); }}
          placeholder="新規フォルダ名..."
          disabled={disabled || creating}
          className="flex-1 min-w-0 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400/50"
        />
        <button
          type="button"
          onClick={() => void handleCreateFolder()}
          disabled={disabled || creating || !newFolderName.trim()}
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black disabled:opacity-40 transition-colors"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
          ＋フォルダ
        </button>
      </div>
    </div>
  );
}
