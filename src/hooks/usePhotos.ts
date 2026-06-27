import { useState } from 'react';
import { doc, setDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  deleteDriveFile,
  deleteStoredPhoto,
  uploadEventPhotoToDrive,
  validateImageFile,
} from '../lib/photoStorage';
import { EventPhoto } from '../types';

export function usePhotos(eventId: string) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhoto(
    file: File,
    opts: { targetFolderId: string; venue?: string; start?: string },
  ): Promise<EventPhoto | null> {
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return null; }

    if (!opts.targetFolderId) {
      setError('保存先フォルダを選択してください');
      return null;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    let uploadedPhoto: EventPhoto | null = null;
    try {
      setUploadProgress(30);
      // Google Drive へ直接アップロード（Cloudinary は使わない）
      uploadedPhoto = await uploadEventPhotoToDrive(eventId, file, opts.targetFolderId);
      setUploadProgress(80);
      await setDoc(doc(db, 'events', eventId), { photos: arrayUnion(uploadedPhoto) }, { merge: true });
      setUploadProgress(100);
      return uploadedPhoto;
    } catch (e) {
      console.error('Photo upload failed:', e);
      if (uploadedPhoto?.driveFileId) {
        deleteDriveFile(uploadedPhoto.driveFileId).catch(err => {
          console.error('Drive cleanup failed:', err);
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
      const toDelete = storedPhoto ?? photo;
      deleteStoredPhoto(toDelete).catch(err => {
        console.error('Cloudinary delete failed:', err);
      });
      if (toDelete.driveFileId) {
        deleteDriveFile(toDelete.driveFileId).catch(err => {
          console.error('Drive file delete failed:', err);
        });
      }
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
