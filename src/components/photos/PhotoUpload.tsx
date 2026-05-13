import { useRef, useState, DragEvent } from 'react';
import { Upload, X, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { validateImageFile, PHOTO_UPLOAD_PROFILE } from '../../lib/photoStorage';

interface Props {
  onUpload: (file: File) => Promise<any>;
  uploading: boolean;
  uploadProgress?: number;
}

export default function PhotoUpload({ onUpload, uploading, uploadProgress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleFile(file: File) {
    const err = validateImageFile(file);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    const url = URL.createObjectURL(file);
    setPreview({ url, name: file.name });
    onUpload(file).finally(() => {
      URL.revokeObjectURL(url);
      setPreview(null);
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
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
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Image size={20} className="text-indigo-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-600">クリックまたはドラッグ＆ドロップ</p>
          <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, WebP, GIF · 最大10MB</p>
          <p className="text-[11px] text-slate-400 mt-1">
            圧縮目安: フル {PHOTO_UPLOAD_PROFILE.targetSizeGuide.fullKb} / サムネ {PHOTO_UPLOAD_PROFILE.targetSizeGuide.thumbnailKb} / 合計 {PHOTO_UPLOAD_PROFILE.targetSizeGuide.totalKb}
          </p>
        </div>
        {uploading && (
          <div className="absolute inset-0 bg-white/80 rounded-2xl flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-indigo-600">
              {uploadProgress != null && uploadProgress > 0
                ? `アップロード中... ${uploadProgress}%`
                : '圧縮中...'}
            </span>
            {uploadProgress != null && uploadProgress > 0 && (
              <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3"
          >
            <img src={preview.url} alt="" className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{preview.name}</p>
              <p className="text-[11px] text-slate-400">圧縮してアップロード中...</p>
            </div>
          </motion.div>
        )}
        {localError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
