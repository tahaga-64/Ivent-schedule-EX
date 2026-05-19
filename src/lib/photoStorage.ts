import { EventPhoto } from '../types';
import { SUPABASE_PHOTO_BUCKET, supabase } from './supabase';

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
export const MAX_PHOTOS = 3;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return '対応画像形式: JPEG, PNG, WebP, GIF, HEIC';
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

function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(SUPABASE_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function buildPhotoPath(eventId: string, photoId: string, fileName: string): string {
  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `events/${safeEventId}/${photoId}/${fileName}`;
}

async function uploadBlob(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from(SUPABASE_PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (error) throw error;
}

export async function uploadEventPhoto(eventId: string, file: File): Promise<EventPhoto> {
  const photoId = crypto.randomUUID();
  const storagePath = buildPhotoPath(eventId, photoId, 'photo.webp');
  const thumbnailStoragePath = buildPhotoPath(eventId, photoId, 'thumb.webp');

  const [photoBlob, thumbnailBlob] = await Promise.all([
    resizeToWebpBlob(file, 2000, 0.88),
    resizeToWebpBlob(file, 400, 0.75),
  ]);

  try {
    await Promise.all([
      uploadBlob(storagePath, photoBlob),
      uploadBlob(thumbnailStoragePath, thumbnailBlob),
    ]);
  } catch (uploadError) {
    supabase.storage.from(SUPABASE_PHOTO_BUCKET).remove([storagePath, thumbnailStoragePath]).catch(() => {});
    throw uploadError;
  }

  return {
    id: photoId,
    url: getPublicUrl(storagePath),
    thumbnailUrl: getPublicUrl(thumbnailStoragePath),
    storagePath,
    thumbnailStoragePath,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteStoredPhoto(photo: EventPhoto): Promise<void> {
  const paths = [photo.storagePath, photo.thumbnailStoragePath].filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(SUPABASE_PHOTO_BUCKET).remove(paths);
  if (error) throw error;
}
