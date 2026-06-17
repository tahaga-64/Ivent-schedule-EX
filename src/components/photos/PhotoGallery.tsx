import { useState, useEffect } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight, Edit3, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EventPhoto } from '../../types';
import { GOOGLE_DRIVE_FOLDER_URL } from '../../lib/photoStorage';

interface Props {
  photos: EventPhoto[];
  onDelete: (photo: EventPhoto) => void;
  onUpdateCaption: (photo: EventPhoto, caption: string) => void;
  canEdit: boolean;
}

export default function PhotoGallery({ photos, onDelete, onUpdateCaption, canEdit }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (lightbox !== null && lightbox >= photos.length) setLightbox(null);
  }, [photos.length, lightbox]);

  if (photos.length === 0) return (
    <div className="text-center py-8 text-slate-400">
      <p className="text-sm font-bold">写真はありません</p>
      <p className="text-xs mt-1">上のエリアから追加してください</p>
    </div>
  );

  function openLightbox(i: number) { setLightbox(i); setConfirming(null); }
  function closeLightbox() { setLightbox(null); }
  function prev() { setLightbox(i => i != null ? (i - 1 + photos.length) % photos.length : null); }
  function next() { setLightbox(i => i != null ? (i + 1) % photos.length : null); }

  function startEdit(photo: EventPhoto) {
    setEditingId(photo.id);
    setCaptionDraft(photo.caption || '');
  }

  function saveCaption(photo: EventPhoto) {
    onUpdateCaption(photo, captionDraft);
    setEditingId(null);
  }

  function handleDelete(photo: EventPhoto) {
    onDelete(photo);
    setConfirming(null);
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <a
          href={GOOGLE_DRIVE_FOLDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
        >
          <ExternalLink size={12} />
          Google Drive フォルダ
        </a>
      </div>
      <div className="space-y-3">
        {photos.map((photo, i) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm"
          >
            {/* 画像エリア */}
            <div className="relative aspect-video bg-slate-100">
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.caption || `イベント写真 ${i + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openLightbox(i)}
              />

              {/* 削除確認オーバーレイ */}
              <AnimatePresence>
                {confirming === photo.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-3"
                    onClick={() => setConfirming(null)}
                  >
                    <p className="text-white text-sm font-bold">この写真を削除しますか？</p>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setConfirming(null)}
                        className="px-4 py-1.5 bg-white/20 text-white rounded-xl text-sm font-medium backdrop-blur-sm"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleDelete(photo)}
                        className="px-4 py-1.5 bg-red-500 text-white rounded-xl text-sm font-bold shadow"
                      >
                        削除する
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 削除ボタン（常時表示） */}
              {canEdit && confirming !== photo.id && (
                <button
                  onClick={() => setConfirming(photo.id)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow transition-colors hover:bg-red-500"
                  aria-label="写真を削除"
                >
                  <Trash2 size={14} className="text-white" />
                </button>
              )}

              {/* 枚数インジケーター */}
              <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                <span className="text-white text-[10px] font-bold">{i + 1} / {photos.length}</span>
              </div>
            </div>

            {/* キャプションエリア */}
            <div className="px-4 py-3">
              {editingId === photo.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={captionDraft}
                    onChange={e => setCaptionDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCaption(photo);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    placeholder="キャプションを入力..."
                    maxLength={100}
                    className="flex-1 text-sm text-slate-700 bg-transparent outline-none border-b-2 border-indigo-400 pb-0.5 placeholder-slate-300"
                  />
                  <button onClick={() => saveCaption(photo)} className="shrink-0 p-1">
                    <Check size={16} className="text-indigo-500" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="shrink-0 p-1">
                    <X size={14} className="text-slate-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => canEdit && startEdit(photo)}
                  className={`w-full text-left flex items-start gap-1.5 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {canEdit && <Edit3 size={12} className="text-slate-300 mt-0.5 shrink-0" />}
                  <p className={`text-sm leading-snug ${photo.caption ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                    {photo.caption || (canEdit ? 'タップしてキャプションを追加...' : '—')}
                  </p>
                </button>
              )}
              <p className="text-[10px] text-slate-300 mt-1.5">
                {new Date(photo.uploadedAt).toLocaleDateString('ja-JP')}
              </p>
              {photo.driveViewUrl && (
                <a
                  href={photo.driveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={11} />
                  Driveで開く
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ライトボックス */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
            onClick={closeLightbox}
          >
            <div className="flex items-center justify-between p-4" onClick={e => e.stopPropagation()}>
              <span className="text-white/60 text-sm font-bold">{lightbox + 1} / {photos.length}</span>
              <button onClick={closeLightbox} className="text-white/60 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center relative" onClick={e => e.stopPropagation()}>
              <button onClick={prev} className="absolute left-4 text-white/60 hover:text-white p-2 z-10">
                <ChevronLeft size={28} />
              </button>
              {photos[lightbox] && (
                <img
                  src={photos[lightbox].url}
                  alt={photos[lightbox].caption || `イベント写真 ${lightbox + 1}`}
                  className="max-w-full max-h-full object-contain rounded-xl"
                  style={{ maxHeight: 'calc(100vh - 180px)' }}
                />
              )}
              <button onClick={next} className="absolute right-4 text-white/60 hover:text-white p-2 z-10">
                <ChevronRight size={28} />
              </button>
            </div>

            <div className="p-4" onClick={e => e.stopPropagation()}>
              {photos[lightbox]?.caption && (
                <p className="text-white/70 text-sm text-center">{photos[lightbox].caption}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
