import { useState } from 'react';
import { doc, updateDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { validateImageFile, uploadToSupabase, deleteFromSupabase } from '../lib/photoStorage';
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
      const photoId = crypto.randomUUID();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const storagePath = `${eventId}/${photoId}.${ext}`;

      const url = await uploadToSupabase(file, storagePath, setUploadProgress);

      const photo: EventPhoto = {
        id: photoId,
        url,
        storagePath,
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
      // Supabase Storage から削除（storagePath がある場合のみ — 旧base64写真はスキップ）
      if (photo.storagePath) {
        await deleteFromSupabase(photo.storagePath);
      }
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
