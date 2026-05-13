import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Edit3, Download, ZoomIn } from 'lucide-react';
import { EventPhoto } from '../../types';
import { usePhotos } from '../../hooks/usePhotos';

interface PhotoGalleryProps {
  eventId: string;
  photos: EventPhoto[];
  onPhotosChange?: () => void;
  className?: string;
}

interface PhotoModalProps {
  photo: EventPhoto;
  onClose: () => void;
  onDelete: () => void;
  onUpdateCaption: (caption: string) => void;
  isUpdating: boolean;
}

function PhotoModal({ photo, onClose, onDelete, onUpdateCaption, isUpdating }: PhotoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption || '');

  const handleSaveCaption = useCallback(() => {
    onUpdateCaption(caption);
    setIsEditing(false);
  }, [caption, onUpdateCaption]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `photo_${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [photo]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                disabled={isUpdating}
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={onDelete}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                disabled={isUpdating}
              >
                <Trash2 size={18} />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image */}
        <img
          src={photo.url}
          alt={photo.caption || 'Event photo'}
          className="w-full h-auto max-h-[70vh] object-contain"
        />

        {/* Caption */}
        <div className="p-4 space-y-3">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="写真の説明を入力"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isUpdating}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCaption}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setCaption(photo.caption || '');
                  }}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 dark:text-gray-300">
              {photo.caption || '説明なし'}
            </p>
          )}
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            アップロード日時: {new Date(photo.uploadedAt).toLocaleString('ja-JP')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PhotoGallery({ 
  eventId, 
  photos, 
  onPhotosChange, 
  className = '' 
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const { deleteEventPhoto, updatePhotoCaption, error, clearError } = usePhotos();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDeletePhoto = useCallback(async (photo: EventPhoto) => {
    if (!confirm('この写真を削除しますか？')) return;

    try {
      await deleteEventPhoto(eventId, photo);
      setSelectedPhoto(null);
      onPhotosChange?.();
    } catch (error) {
      // Error is handled by the hook
    }
  }, [eventId, deleteEventPhoto, onPhotosChange]);

  const handleUpdateCaption = useCallback(async (caption: string) => {
    if (!selectedPhoto) return;

    setIsUpdating(true);
    try {
      await updatePhotoCaption(eventId, selectedPhoto, caption);
      setSelectedPhoto({ ...selectedPhoto, caption });
      onPhotosChange?.();
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsUpdating(false);
    }
  }, [eventId, selectedPhoto, updatePhotoCaption, onPhotosChange]);

  if (photos.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-400 dark:text-gray-500 space-y-2">
          <ZoomIn size={48} className="mx-auto" />
          <p>アップロードされた写真はありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={photo.url}
              alt={photo.caption || 'Event photo'}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn 
                size={24} 
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            
            {/* Caption */}
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-white text-xs truncate">{photo.caption}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <PhotoModal
            photo={selectedPhoto}
            onClose={() => setSelectedPhoto(null)}
            onDelete={() => handleDeletePhoto(selectedPhoto)}
            onUpdateCaption={handleUpdateCaption}
            isUpdating={isUpdating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}