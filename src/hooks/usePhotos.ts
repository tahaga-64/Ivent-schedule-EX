import { useState } from 'react';
import { doc, updateDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { compressPhoto, validateImageFile } from '../lib/photoStorage';
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
    try {
      setUploadProgress(20);
      const { url, thumbnailUrl } = await compressPhoto(file);
      setUploadProgress(80);
      const photo: EventPhoto = {
        id: crypto.randomUUID(),
        url,
        thumbnailUrl,
        uploadedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'events', eventId), { photos: arrayUnion(photo) });
      setUploadProgress(100);
      return photo;
    } catch (e) {
      console.error('Photo upload failed:', e);
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
