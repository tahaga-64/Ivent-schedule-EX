import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Images } from 'lucide-react';
import type { Event, EventPhoto } from '../types';
import { rs } from '../lib/eventHelpers';

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

  // Detail view — single event's photos
  if (selectedEvent) {
    const lbPhotos: LightboxPhoto[] = (selectedEvent.photos ?? []).map(p => ({ ...p, eventVenue: selectedEvent.venue }));
    const regionColor = rs(selectedEvent.region || '').dot;

    return (
      <div className="relative z-10 flex flex-col min-h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <button
            onClick={() => setSelectedId(null)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="w-1 h-5 rounded-full shrink-0" style={{ background: regionColor }} />
          <div className="min-w-0">
            <div className="font-black text-sm text-white truncate">{selectedEvent.venue}</div>
            <div className="text-[10px] text-white/50">{fmtDate(selectedEvent.start, selectedEvent.end)} · {lbPhotos.length}枚</div>
          </div>
        </div>

        {/* Photo grid */}
        <div className="p-3 pb-28">
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
            {lbPhotos.map((photo, i) => (
              <motion.button
                key={photo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openLightbox(lbPhotos, i)}
                className="relative aspect-square overflow-hidden rounded-lg bg-white/5"
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.caption || `写真 ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Lightbox */}
        <Lightbox lightbox={lightbox} onClose={closeLightbox} onPrev={lbPrev} onNext={lbNext} />
      </div>
    );
  }

  // Album list
  return (
    <div className="relative z-10 flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div>
          <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">PHOTOS</div>
          <h2 className="text-base font-black text-white">アルバム</h2>
        </div>
        <div className="text-xs font-bold text-white/40">{albumEvents.length}件のアルバム</div>
      </div>

      {albumEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-20 text-white/40">
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
                  className="rounded-2xl overflow-hidden border border-white/15 bg-white/5 cursor-pointer"
                  onClick={() => setSelectedId(ev.id)}
                >
                  {/* Cover image */}
                  <div className="relative aspect-[4/3] bg-white/5">
                    {cover ? (
                      <img
                        src={cover.thumbnailUrl || cover.url}
                        alt={ev.venue}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Images size={24} className="text-white/20" />
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
                    {/* Quick lightbox on long press / direct photo tap */}
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
                      <div className="font-black text-xs text-white truncate">{ev.venue}</div>
                    </div>
                    <div className="text-[10px] text-white/45">{fmtDate(ev.start, ev.end)}</div>
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
