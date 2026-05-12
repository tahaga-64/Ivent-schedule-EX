import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { EventPhoto } from '../types';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return '対応画像形式: JPEG, PNG, WebP, GIF, HEIC';
  if (file.size > MAX_SIZE_BYTES) return 'ファイルサイズは10MB以下にしてください';
  return null;
}

export async function compressImage(file: File, maxWidth = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/webp',
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function uploadAndCompressPhoto(
  file: File,
  eventId: string,
  photoId: string
): Promise<{ url: string; storagePath: string; thumbnailUrl: string }> {
  const compressed = await compressImage(file);
  const thumb = await compressImage(file, 400, 0.75);

  const basePath = `events/${eventId}/photos/${photoId}`;
  const fullRef = ref(storage, `${basePath}/full.webp`);
  const thumbRef = ref(storage, `${basePath}/thumb.webp`);

  await Promise.all([
    uploadBytes(fullRef, compressed, { contentType: 'image/webp' }),
    uploadBytes(thumbRef, thumb, { contentType: 'image/webp' }),
  ]);

  const [url, thumbnailUrl] = await Promise.all([
    getDownloadURL(fullRef),
    getDownloadURL(thumbRef),
  ]);

  return { url, storagePath: basePath, thumbnailUrl };
}

export async function deletePhoto(photo: EventPhoto): Promise<void> {
  const fullRef = ref(storage, `${photo.storagePath}/full.webp`);
  const thumbRef = ref(storage, `${photo.storagePath}/thumb.webp`);
  await Promise.allSettled([deleteObject(fullRef), deleteObject(thumbRef)]);
}
