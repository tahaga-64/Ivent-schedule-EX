import { useState, useEffect, useCallback } from 'react';
import { Folder, ExternalLink, Loader2, ChevronLeft, RefreshCw } from 'lucide-react';
import { GOOGLE_DRIVE_FOLDER_URL, listDriveFolders, type DriveFolder } from '../lib/photoStorage';

export default function AlbumView() {
  const [parentId, setParentId] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDriveFolders();
      setParentId(data.parentId);
      setFolders(data.folders);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="relative z-10 flex flex-col min-h-full bg-[var(--bg-app)]">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white">
        <div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHOTOS</div>
          <h2 className="text-2xl font-black text-slate-900">Google Drive</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
            title="再読み込み"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <a
            href={GOOGLE_DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink size={14} />
            Driveで開く
          </a>
        </div>
      </div>

      <div className="p-4 pb-28">
        <p className="text-xs text-slate-500 mb-4">
          イベント写真は共有 Drive フォルダ内のサブフォルダに保存されます。アップロード時にフォルダを選択してください。
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm font-bold">フォルダを読み込み中...</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Folder size={40} className="opacity-40" />
            <p className="text-sm font-bold">サブフォルダがありません</p>
            <p className="text-xs">写真アップロード時に新規フォルダを作成できます</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folders.map(folder => (
              <a
                key={folder.id}
                href={`https://drive.google.com/drive/folders/${folder.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all active:scale-[0.98]"
              >
                <Folder size={28} className="text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm text-slate-900 truncate">{folder.name}</div>
                  {folder.modifiedTime && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      更新: {new Date(folder.modifiedTime).toLocaleDateString('ja-JP')}
                    </div>
                  )}
                </div>
                <ExternalLink size={16} className="text-slate-300 shrink-0" />
              </a>
            ))}
          </div>
        )}

        {parentId && (
          <div className="mt-6">
            <a
              href={`https://drive.google.com/drive/folders/${parentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              <ChevronLeft size={14} />
              ルートフォルダを Drive で開く
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
