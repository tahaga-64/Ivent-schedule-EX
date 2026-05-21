import { EventPhoto } from '../types';

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 3;

const CLOUD_NAME = 'dqwvmz3hk';
const UPLOAD_PRESET = 'events photo';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

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

export async function uploadEventPhoto(eventId: string, file: File): Promise<EventPhoto> {
  const photoId = crypto.randomUUID();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', `events/${eventId}`);
  formData.append('public_id', photoId);

  const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message ?? 'Cloudinaryへのアップロードに失敗しました');
  }

  const data = await response.json();
  const publicId: string = data.public_id;

  const base = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

  return {
    id: photoId,
    url: `${base}/w_2000,q_88,f_webp/${publicId}`,
    thumbnailUrl: `${base}/w_400,q_75,f_webp/${publicId}`,
    storagePath: publicId,
    uploadedAt: new Date().toISOString(),
  };
}

// Cloudinary の削除はAPIシークレットが必要なためサーバーサイド処理が必要。
// 現状はFirestoreから参照を外すのみで、ストレージ側の実ファイルは残る。
export async function deleteStoredPhoto(photo: EventPhoto): Promise<void> {
  if (photo.storagePath) {
    console.warn('Cloudinary file not deleted (requires server-side secret):', photo.storagePath);
  }
}
