import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Images, Trash2 } from 'lucide-react';
import type { Event, EventPhoto } from '../types';
import { rs } from '../lib/eventHelpers';
import { usePhotos } from '../hooks/usePhotos';

interface Props {
  events: Event[];
}

function fmtDate(start: string, end: string): string {
  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

interface LightboxPhoto extends EventPhoto {
  eventVenue: string;
}

function AlbumDetail({ event, onBack }: { event: Event; onBack: () => void }) {
  const { deleteEventPhoto } = usePhotos(event.id);
  const [confirmDelete, setConfirmDelete] = useState<EventPhoto | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);
  const regionColor = rs(event.region || '').dot;
  const lbPhotos: LightboxPhoto[] = (event.photos ?? []).map(p => ({ ...p, eventVenue: event.venue }));

  function openLightbox(index: number) { setLightbox({ photos: lbPhotos, index }); }
  function closeLightbox() { setLightbox(null); }
  function lbPrev() { setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null); }
  function lbNext() { setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null); }

  async function handleDelete(photo: EventPhoto) {
    // lightbox 用に eventVenue を付与した派生オブジェクトではなく、
    // Firestore 配列に格納されている元の photo オブジェクトを arrayRemove に渡す
    // （余計なフィールドがあると arrayRemove が一致せず削除されないため）
    const original = (event.photos ?? []).find(p => p.id === photo.id) ?? photo;
    await deleteEventPhoto(original);
    setConfirmDelete(null);
  }

  return (
    <div className="relative z-10 flex flex-col min-h-full bg-[var(--bg-app)]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-white">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="w-1 h-5 rounded-full shrink-0" style={{ background: regionColor }} />
        <div className="min-w-0">
          <div className="font-black text-sm text-slate-900 truncate">{event.venue}</div>
          <div className="text-[10px] text-slate-500">{fmtDate(event.start, event.end)} · {lbPhotos.length}枚</div>
        </div>
      </div>

      {/* Photo grid */}
      <div className="p-3 pb-28">
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
          {lbPhotos.map((photo, i) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 border border-slate-200 group"
            >
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.caption || `写真 ${i + 1}`}
                onClick={() => openLightbox(i)}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
              />
              {/* Delete button */}
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(photo); }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                title="写真を削除"
              >
                <Trash2 size={11} className="text-white" />
              </button>
              {/* Delete confirmation overlay */}
              {confirmDelete?.id === photo.id && (
                <div
                  className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 rounded-lg"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-[11px] text-white text-center px-2 font-bold">削除しますか？</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2.5 py-1 text-[10px] rounded-lg bg-white/20 text-white font-bold hover:bg-white/30 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleDelete(photo)}
                      className="px-2.5 py-1 text-[10px] rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <Lightbox lightbox={lightbox} onClose={closeLightbox} onPrev={lbPrev} onNext={lbNext} />
    </div>
  );
}

export default function AlbumView({ events }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);

  const albumEvents = useMemo(
    () => events.filter(e => e.photos && e.photos.length > 0)
              .sort((a, b) => b.start.localeCompare(a.start)),
    [events]
  );

  const selectedEvent = albumEvents.find(e => e.id === selectedId) ?? null;

  function openLightbox(photos: LightboxPhoto[], index: number) {
    setLightbox({ photos, index });
  }

  function closeLightbox() { setLightbox(null); }

  function lbPrev() {
    setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null);
  }

  function lbNext() {
    setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null);
  }

  if (selectedEvent) {
    return <AlbumDetail event={selectedEvent} onBack={() => setSelectedId(null)} />;
  }

  // Album list
  return (
    <div className="relative z-10 flex flex-col min-h-full bg-[var(--bg-app)]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white">
        <div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHOTOS</div>
          <h2 className="text-2xl font-black text-slate-900">アルバム</h2>
        </div>
        <div className="text-xs font-bold text-slate-400">{albumEvents.length}件のアルバム</div>
      </div>

      {albumEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-20 text-slate-400">
          <Images size={40} className="opacity-40" />
          <div className="text-sm font-bold">写真がありません</div>
          <div className="text-xs">イベント詳細の「写真」タブからアップロードできます</div>
        </div>
      ) : (
        <div className="p-4 pb-28">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {albumEvents.map(ev => {
              const photos = ev.photos ?? [];
              const cover = photos[0];
              const regionColor = rs(ev.region || '').dot;
              const allLbPhotos: LightboxPhoto[] = photos.map(p => ({ ...p, eventVenue: ev.venue }));

              return (
                <motion.div
                  key={ev.id}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl overflow-hidden border border-slate-200 bg-white cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                  onClick={() => setSelectedId(ev.id)}
                >
                  {/* Cover image */}
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {cover ? (
                      <img
                        src={cover.thumbnailUrl || cover.url}
                        alt={ev.venue}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Images size={24} className="text-slate-300" />
                      </div>
                    )}
                    {/* Photo count badge */}
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Images size={10} className="text-white/70" />
                      <span className="text-[10px] font-black text-white">{photos.length}</span>
                    </div>
                    {/* Quick preview strip if multiple photos */}
                    {photos.length > 1 && (
                      <div className="absolute bottom-0 left-0 right-0 flex gap-px h-8 overflow-hidden">
                        {photos.slice(1, 4).map(p => (
                          <div key={p.id} className="flex-1 bg-black/20">
                            <img src={p.thumbnailUrl || p.url} alt="" className="w-full h-full object-cover opacity-70" />
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="absolute inset-0"
                      onClick={e => { e.stopPropagation(); setSelectedId(ev.id); }}
                      aria-label={`${ev.venue}のアルバムを開く`}
                    />
                  </div>

                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: regionColor }} />
                      <div className="font-black text-xs text-slate-900 truncate">{ev.venue}</div>
                    </div>
                    <div className="text-[10px] text-slate-500">{fmtDate(ev.start, ev.end)}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <Lightbox lightbox={lightbox} onClose={closeLightbox} onPrev={lbPrev} onNext={lbNext} />
    </div>
  );
}

function Lightbox({ lightbox, onClose, onPrev, onNext }: {
  lightbox: { photos: LightboxPhoto[]; index: number } | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <AnimatePresence>
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/96 flex flex-col"
          onClick={onClose}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
            <div>
              <div className="text-white/80 text-xs font-bold">{lightbox.photos[lightbox.index]?.eventVenue}</div>
              <div className="text-white/40 text-[10px]">{lightbox.index + 1} / {lightbox.photos.length}</div>
            </div>
            <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center relative px-12" onClick={e => e.stopPropagation()}>
            <button onClick={onPrev} className="absolute left-2 p-2 text-white/50 hover:text-white transition-colors z-10">
              <ChevronLeft size={28} />
            </button>
            <AnimatePresence mode="wait">
              <motion.img
                key={lightbox.index}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                src={lightbox.photos[lightbox.index]?.url}
                alt={lightbox.photos[lightbox.index]?.caption || ''}
                className="max-w-full max-h-full object-contain rounded-lg"
                style={{ maxHeight: 'calc(100dvh - 140px)' }}
              />
            </AnimatePresence>
            <button onClick={onNext} className="absolute right-2 p-2 text-white/50 hover:text-white transition-colors z-10">
              <ChevronRight size={28} />
            </button>
          </div>

          {/* Caption */}
          <div className="px-4 py-3 shrink-0 min-h-[44px] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {lightbox.photos[lightbox.index]?.caption && (
              <p className="text-white/60 text-sm text-center">{lightbox.photos[lightbox.index].caption}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
