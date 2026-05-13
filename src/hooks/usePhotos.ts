import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadAndCompressPhoto, deletePhoto } from '../lib/photoStorage';
import { validateImageFile } from '../lib/photoStorage';
import { EventPhoto } from '../types';

export function usePhotos(eventId: string) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(file: File): Promise<EventPhoto | null> {
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return null; }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { url, storagePath, thumbnailUrl } = await uploadAndCompressPhoto(
        file,
        eventId,
        photoId,
        (pct) => setUploadProgress(pct)
      );
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
      console.error('Upload failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('storage/unauthorized') || msg.includes('permission')) {
        setError('アップロード権限がありません。ログイン状態を確認してください。');
      } else if (msg.includes('storage/canceled')) {
        setError('アップロードがキャンセルされました。');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('ネットワークエラーです。接続を確認してください。');
      } else {
        setError(`アップロードに失敗しました: ${msg}`);
      }
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
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

  async function updatePhotoCaption(photo: EventPhoto, caption: string, currentPhotos: EventPhoto[]): Promise<void> {
    try {
      const updated = currentPhotos.map(p => p.id === photo.id ? { ...p, caption } : p);
      await updateDoc(doc(db, 'events', eventId), { photos: updated });
    } catch (e) {
      setError('キャプション更新に失敗しました');
    }
  }

  return { uploading, uploadProgress, error, uploadPhoto, deleteEventPhoto, updatePhotoCaption };
}
