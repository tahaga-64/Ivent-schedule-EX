import { useRef, useState, DragEvent } from 'react';
import { X, Image, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { validateImageFile } from '../../lib/photoStorage';
import DriveFolderPicker from './DriveFolderPicker';

interface Props {
  onUpload: (file: File, targetFolderId: string) => Promise<unknown>;
  uploading: boolean;
  uploadProgress?: number;
  currentCount?: number;
  maxPhotos?: number;
}

export default function PhotoUpload({ onUpload, uploading, uploadProgress, currentCount = 0, maxPhotos = 3 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [targetFolderName, setTargetFolderName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function clearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setTargetFolderId(null);
    setTargetFolderName(null);
    setLocalError(null);
  }

  function handleFileSelect(file: File) {
    const err = validateImageFile(file);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setTargetFolderId(null);
    setTargetFolderName(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleSaveToDrive() {
    if (!selectedFile || !targetFolderId || uploading) return;
    setLocalError(null);
    try {
      await onUpload(selectedFile, targetFolderId);
      clearSelection();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLocalError(msg);
    }
  }

  const remaining = maxPhotos - currentCount;
  const step = selectedFile ? 2 : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold text-slate-500">
          イベント写真 {step === 2 ? '（②フォルダ選択）' : '（①ファイル選択）'}
        </p>
        <span className="text-[11px] text-slate-400">{currentCount} / {maxPhotos} 枚</span>
      </div>

      {step === 1 && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors cursor-pointer
            ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
          />
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Image size={20} className="text-indigo-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-600">クリックまたはドラッグ＆ドロップ</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Cloudinary で表示 · Drive にも保存 · あと{remaining}枚追加可能
          </p>
          </div>
        </div>
      )}

      {step === 2 && selectedFile && previewUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <img src={previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              disabled={uploading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              aria-label="選択をクリア"
            >
              <X size={16} />
            </button>
          </div>

          <DriveFolderPicker
            selectedId={targetFolderId}
            disabled={uploading}
            onSelect={(id, name) => {
              setTargetFolderId(id);
              setTargetFolderName(name);
            }}
          />

          {targetFolderId && (
            <p className="text-[11px] font-bold text-indigo-700">
              保存先: {targetFolderName}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSaveToDrive()}
            disabled={!targetFolderId || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black disabled:opacity-40 transition-colors"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Upload size={16} />
                Driveにも保存
              </>
            )}
          </button>

          {uploading && uploadProgress != null && uploadProgress > 0 && (
            <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {localError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
          >
            <X size={14} className="text-red-500 shrink-0" />
            <span className="text-xs text-red-600">{localError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
