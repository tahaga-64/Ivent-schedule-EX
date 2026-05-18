import { useState } from 'react';
import { doc, updateDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { deleteStoredPhoto, uploadEventPhoto, validateImageFile } from '../lib/photoStorage';
import { EventPhoto } from '../types';

export function usePhotos(eventId: string) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(file: File): Promise<EventPhoto | null> {
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return null; }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    let uploadedPhoto: EventPhoto | null = null;
    try {
      setUploadProgress(20);
      uploadedPhoto = await uploadEventPhoto(eventId, file);
      setUploadProgress(80);
      await updateDoc(doc(db, 'events', eventId), { photos: arrayUnion(uploadedPhoto) });
      setUploadProgress(100);
      return uploadedPhoto;
    } catch (e) {
      console.error('Photo upload failed:', e);
      if (uploadedPhoto) {
        deleteStoredPhoto(uploadedPhoto).catch(error => {
          console.error('Uploaded photo cleanup failed:', error);
        });
      }
      setError('アップロードに失敗しました');
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteEventPhoto(photo: EventPhoto): Promise<void> {
    try {
      const eventRef = doc(db, 'events', eventId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(eventRef);
        if (!snap.exists()) return;
        const photos: EventPhoto[] = snap.data().photos ?? [];
        tx.update(eventRef, { photos: photos.filter(p => p.id !== photo.id) });
      });
      deleteStoredPhoto(photo).catch(error => {
        console.error('Stored photo delete failed:', error);
        setError('写真ファイルの削除に一部失敗しました');
      });
    } catch (e) {
      setError('削除に失敗しました');
    }
  }

  async function updatePhotoCaption(photo: EventPhoto, caption: string): Promise<void> {
    try {
      const eventRef = doc(db, 'events', eventId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(eventRef);
        if (!snap.exists()) return;
        const photos: EventPhoto[] = snap.data().photos ?? [];
        tx.update(eventRef, { photos: photos.map(p => p.id === photo.id ? { ...p, caption } : p) });
      });
    } catch (e) {
      setError('キャプション更新に失敗しました');
    }
  }

  return { uploading, uploadProgress, error, uploadPhoto, deleteEventPhoto, updatePhotoCaption };
}
