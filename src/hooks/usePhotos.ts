import { useState } from 'react';
import { doc, setDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { deleteStoredPhoto, syncPhotoToDrive, uploadEventPhoto, validateImageFile } from '../lib/photoStorage';
import { EventPhoto } from '../types';

export function usePhotos(eventId: string) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(
    file: File,
    meta?: { venue?: string; start?: string },
  ): Promise<EventPhoto | null> {
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return null; }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    let uploadedPhoto: EventPhoto | null = null;
    try {
      setUploadProgress(20);
      uploadedPhoto = await uploadEventPhoto(eventId, file);
      setUploadProgress(50);

      const driveResult = await syncPhotoToDrive({
        imageUrl: uploadedPhoto.url,
        eventId,
        venue: meta?.venue,
        start: meta?.start,
        fileName: file.name,
      });
      if (driveResult) {
        uploadedPhoto = {
          ...uploadedPhoto,
          driveFileId: driveResult.fileId,
          driveViewUrl: driveResult.webViewLink,
        };
      }

      setUploadProgress(80);
      await setDoc(doc(db, 'events', eventId), { photos: arrayUnion(uploadedPhoto) }, { merge: true });
      setUploadProgress(100);
      return uploadedPhoto;
    } catch (e) {
      console.error('Photo upload failed:', e);
      if (uploadedPhoto) {
        deleteStoredPhoto(uploadedPhoto).catch(error => {
          console.error('Uploaded photo cleanup failed:', error);
        });
      }
      const msg = e instanceof Error ? e.message : String(e);
      setError(`アップロードに失敗しました: ${msg}`);
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteEventPhoto(photo: EventPhoto): Promise<void> {
    setError(null);
    try {
      const eventRef = doc(db, 'events', eventId);
      let storedPhoto: EventPhoto | undefined;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(eventRef);
        if (!snap.exists()) return;
        const photos: EventPhoto[] = snap.data().photos ?? [];
        storedPhoto = photos.find(p => p.id === photo.id);
        tx.update(eventRef, { photos: photos.filter(p => p.id !== photo.id) });
      });
      deleteStoredPhoto(storedPhoto ?? photo).catch(err => {
        console.error('Stored photo delete failed:', err);
      });
    } catch (e) {
      setError('削除に失敗しました');
    }
  }

  async function updatePhotoCaption(photo: EventPhoto, caption: string): Promise<void> {
    setError(null);
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
