import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadAndCompressPhoto, deletePhoto } from '../lib/photoStorage';
import { validateImageFile } from '../lib/photoStorage';
import { EventPhoto } from '../types';

export function usePhotos(eventId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(file: File): Promise<EventPhoto | null> {
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return null; }

    setUploading(true);
    setError(null);
    try {
      const photoId = crypto.randomUUID();
      const { url, storagePath, thumbnailUrl } = await uploadAndCompressPhoto(file, eventId, photoId);
      const photo: EventPhoto = {
        id: photoId,
        url,
        storagePath,
        thumbnailUrl,
        uploadedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'events', eventId), { photos: arrayUnion(photo) });
      return photo;
    } catch (e) {
      console.error('Photo upload failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('storage/unauthorized') || msg.includes('permission')) {
        setError('アップロード権限がありません。ログイン状態を確認してください。');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('ネットワークエラーです。接続を確認してください。');
      } else {
        setError('アップロードに失敗しました');
      }
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function deleteEventPhoto(photo: EventPhoto, currentPhotos: EventPhoto[]): Promise<void> {
    try {
      await deletePhoto(photo);
      await updateDoc(doc(db, 'events', eventId), { photos: arrayRemove(photo) });
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
        const updated = photos.map(p => p.id === photo.id ? { ...p, caption } : p);
        tx.update(eventRef, { photos: updated });
      });
    } catch (e) {
      console.error('Caption update failed:', e);
      setError('キャプション更新に失敗しました');
    }
  }

  return { uploading, error, uploadPhoto, deleteEventPhoto, updatePhotoCaption };
}
