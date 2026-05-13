import { useState, useCallback } from 'react';
import { EventPhoto } from '../types';
import { 
  uploadAndCompressPhoto, 
  deletePhoto, 
  generatePhotoId, 
  validateImageFile 
} from '../lib/photoStorage';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface UsePhotosReturn {
  uploading: boolean;
  uploadPhoto: (eventId: string, file: File, caption?: string) => Promise<EventPhoto>;
  deleteEventPhoto: (eventId: string, photo: EventPhoto) => Promise<void>;
  updatePhotoCaption: (eventId: string, photo: EventPhoto, caption: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function usePhotos(): UsePhotosReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const uploadPhoto = useCallback(async (
    eventId: string, 
    file: File, 
    caption?: string
  ): Promise<EventPhoto> => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      throw new Error(validation.error);
    }

    setUploading(true);
    setError(null);

    try {
      const photoId = generatePhotoId();
      const photo = await uploadAndCompressPhoto(eventId, file, photoId);
      
      if (caption) {
        photo.caption = caption;
      }

      // Update event document with new photo
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        photos: arrayUnion(photo)
      });

      return photo;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アップロードに失敗しました';
      setError(errorMessage);
      handleFirestoreError(err, OperationType.UPDATE, `events/${eventId}`);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const deleteEventPhoto = useCallback(async (
    eventId: string, 
    photo: EventPhoto
  ): Promise<void> => {
    setError(null);

    try {
      // Delete from storage
      await deletePhoto(photo);

      // Remove from event document
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        photos: arrayRemove(photo)
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '削除に失敗しました';
      setError(errorMessage);
      handleFirestoreError(err, OperationType.UPDATE, `events/${eventId}`);
      throw err;
    }
  }, []);

  const updatePhotoCaption = useCallback(async (
    eventId: string,
    photo: EventPhoto,
    caption: string
  ): Promise<void> => {
    setError(null);

    try {
      const updatedPhoto = { ...photo, caption };
      
      // Remove old photo and add updated one
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        photos: arrayRemove(photo)
      });
      
      await updateDoc(eventRef, {
        photos: arrayUnion(updatedPhoto)
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'キャプションの更新に失敗しました';
      setError(errorMessage);
      handleFirestoreError(err, OperationType.UPDATE, `events/${eventId}`);
      throw err;
    }
  }, []);

  return {
    uploading,
    uploadPhoto,
    deleteEventPhoto,
    updatePhotoCaption,
    error,
    clearError
  };
}