import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Images, ExternalLink, Folder, ChevronRight, ChevronLeft, X, RefreshCw, FolderOpen } from 'lucide-react';
import {
  GOOGLE_DRIVE_FOLDER_URL,
  GOOGLE_DRIVE_FOLDER_ID,
  listDriveFolders,
  listDriveFiles,
  driveImageUrl,
  type DriveFolder,
  type DriveFile,
} from '../lib/photoStorage';

interface Crumb {
  id: string;
  name: string;
}

const ROOT: Crumb = { id: GOOGLE_DRIVE_FOLDER_ID, name: 'アルバム' };

export default function AlbumView() {
  const [trail, setTrail] = useState<Crumb[]>([ROOT]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const current = trail[trail.length - 1];
  const loadTokenRef = useRef(0);

  // silent=true は自動更新用（スピナーを出さず、失敗しても既存表示を消さない）
  const load = useCallback(async (folderId: string, silent: boolean) => {
    const token = ++loadTokenRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [folderRes, fileRes] = await Promise.all([
        listDriveFolders(folderId),
        listDriveFiles(folderId),
      ]);
      if (token !== loadTokenRef.current) return; // 古い（フォルダ移動前の）結果は破棄
      setFolders(folderRes.folders);
      setFiles(fileRes.files);
      setError(null);
    } catch (e) {
      if (token !== loadTokenRef.current) return;
      if (!silent) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
        setFolders([]);
        setFiles([]);
      }
    } finally {
      if (token === loadTokenRef.current && !silent) setLoading(false);
    }
  }, []);

  // 初期表示・フォルダ移動・手動更新
  useEffect(() => {
    load(current.id, false);
  }, [current.id, reloadKey, load]);

  // リアルタイム同期: アプリに戻った時＋表示中は定期的に、サイレント自動更新
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') load(current.id, true);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, [current.id, load]);

  const openFolder = useCallback((f: DriveFolder) => {
    setTrail(prev => [...prev, { id: f.id, name: f.name }]);
    setLightbox(null);
  }, []);

  const jumpTo = useCallback((index: number) => {
    setTrail(prev => prev.slice(0, index + 1));
    setLightbox(null);
  }, []);

  const showLightbox = lightbox !== null && files[lightbox];

  return (
    <div className="relative z-10 flex flex-col min-h-full bg-[var(--bg-app)]">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 px-4 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHOTOS</div>
            <h2 className="text-2xl font-black text-slate-900">アルバム</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setReloadKey(k => k + 1)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              更新
            </button>
            <a
              href={GOOGLE_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink size={14} />
              Driveで開く
            </a>
          </div>
        </div>

        {/* パンくず */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {trail.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
              <button
                type="button"
                onClick={() => jumpTo(i)}
                className={`text-xs font-black px-1.5 py-0.5 rounded-md transition-colors ${
                  i === trail.length - 1
                    ? 'text-slate-900'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {c.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 本体 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            読み込み中…
          </div>
        ) : error ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <Images size={36} className="text-slate-300" />
            <div className="text-sm font-black text-slate-700">読み込みに失敗しました</div>
            <div className="text-xs text-slate-400 max-w-xs">{error}</div>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <FolderOpen size={36} className="text-slate-300" />
            <div className="text-sm font-black text-slate-700">このフォルダは空です</div>
            <div className="text-xs text-slate-400">写真やサブフォルダがありません</div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-5">
            {/* サブフォルダ */}
            {folders.length > 0 && (
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">フォルダ</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {folders.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => openFolder(f)}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left hover:bg-slate-50 hover:border-indigo-200 active:scale-[0.99] transition-all shadow-sm"
                    >
                      <Folder size={18} className="text-indigo-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-800 truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 画像 */}
            {files.length > 0 && (
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                  写真（{files.length}）
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                  {files.map((file, i) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setLightbox(i)}
                      className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={driveImageUrl(file.id, 'thumb')}
                        alt={file.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ライトボックス */}
      {showLightbox && createPortal(
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
              aria-label="閉じる"
            >
              <X size={26} />
            </button>
            {lightbox > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}
                className="absolute left-2 sm:left-4 p-2 text-white/70 hover:text-white"
                aria-label="前へ"
              >
                <ChevronLeft size={32} />
              </button>
            )}
            <img
              src={driveImageUrl(files[lightbox].id, 'full')}
              alt={files[lightbox].name}
              className="max-w-full max-h-full object-contain rounded-xl"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
              onClick={e => e.stopPropagation()}
            />
            {lightbox < files.length - 1 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }}
                className="absolute right-2 sm:right-4 p-2 text-white/70 hover:text-white"
                aria-label="次へ"
              >
                <ChevronRight size={32} />
              </button>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-bold max-w-[80vw] truncate">
              {files[lightbox].name}（{lightbox + 1} / {files.length}）
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
