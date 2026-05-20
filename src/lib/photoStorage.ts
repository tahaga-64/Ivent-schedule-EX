import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { EventPhoto } from '../types';
import { storage } from './firebase';

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 3;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.avif', '.bmp', '.tiff'];

export function validateImageFile(file: File): string | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const isImage = type.startsWith('image/') ||
    IMAGE_EXTENSIONS.some(ext => name.endsWith(ext));
  if (!isImage) return '画像ファイルを選択してください';
  if (file.size > MAX_SIZE_BYTES) return 'ファイルサイズは10MB以下にしてください';
  return null;
}

async function resizeToWebpBlob(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => {
          canvas.width = 0;
          canvas.height = 0;
          if (!blob) { reject(new Error('圧縮に失敗しました')); return; }
          resolve(blob);
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    img.src = objectUrl;
  });
}

function buildPhotoPath(eventId: string, photoId: string, fileName: string): string {
  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `events/${safeEventId}/${photoId}/${fileName}`;
}

async function uploadBlob(path: string, blob: Blob): Promise<string> {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/webp' });
  return getDownloadURL(fileRef);
}

export async function uploadEventPhoto(eventId: string, file: File): Promise<EventPhoto> {
  const photoId = crypto.randomUUID();
  const storagePath = buildPhotoPath(eventId, photoId, 'photo.webp');
  const thumbnailStoragePath = buildPhotoPath(eventId, photoId, 'thumb.webp');

  const [photoBlob, thumbnailBlob] = await Promise.all([
    resizeToWebpBlob(file, 2000, 0.88),
    resizeToWebpBlob(file, 400, 0.75),
  ]);

  let photoUrl: string;
  let thumbnailUrl: string;
  try {
    [photoUrl, thumbnailUrl] = await Promise.all([
      uploadBlob(storagePath, photoBlob),
      uploadBlob(thumbnailStoragePath, thumbnailBlob),
    ]);
  } catch (uploadError) {
    Promise.allSettled([
      deleteObject(ref(storage, storagePath)),
      deleteObject(ref(storage, thumbnailStoragePath)),
    ]).catch(() => {});
    throw uploadError;
  }

  return {
    id: photoId,
    url: photoUrl,
    thumbnailUrl,
    storagePath,
    thumbnailStoragePath,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteStoredPhoto(photo: EventPhoto): Promise<void> {
  const paths = [photo.storagePath, photo.thumbnailStoragePath].filter((path): path is string => Boolean(path));
  await Promise.all(paths.map(async (path) => {
    try {
      await deleteObject(ref(storage, path));
    } catch (e) {
      console.error(`Failed to delete ${path}:`, e);
    }
  }));
}
