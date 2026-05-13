import { useState } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight, Edit3, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EventPhoto } from '../../types';

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

  if (photos.length === 0) return (
    <div className="text-center py-8 text-slate-400">
      <p className="text-sm font-bold">写真はありません</p>
      <p className="text-xs mt-1">上のエリアから追加してください</p>
    </div>
  );

  function openLightbox(i: number) { setLightbox(i); }
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

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer"
            onClick={() => openLightbox(i)}
          >
            <img
              src={photo.thumbnailUrl || photo.url}
              alt={photo.caption || ''}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            {canEdit && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(photo); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={11} className="text-white" />
              </button>
            )}
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-white text-[10px] font-medium truncate">{photo.caption}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

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
              <img
                src={photos[lightbox].url}
                alt=""
                className="max-w-full max-h-full object-contain rounded-xl"
                style={{ maxHeight: 'calc(100vh - 180px)' }}
              />
              <button onClick={next} className="absolute right-4 text-white/60 hover:text-white p-2 z-10">
                <ChevronRight size={28} />
              </button>
            </div>

            <div className="p-4" onClick={e => e.stopPropagation()}>
              {editingId === photos[lightbox].id ? (
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                  <input
                    autoFocus
                    value={captionDraft}
                    onChange={e => setCaptionDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveCaption(photos[lightbox])}
                    placeholder="キャプションを入力..."
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40"
                  />
                  <button onClick={() => saveCaption(photos[lightbox])}>
                    <Check size={16} className="text-emerald-400" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-white/70 text-sm flex-1">{photos[lightbox].caption || ''}</p>
                  {canEdit && (
                    <button onClick={() => startEdit(photos[lightbox])} className="text-white/40 hover:text-white p-1">
                      <Edit3 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
