import { EventPhoto } from '../types';
import { auth } from './firebase';

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;

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

export const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

export interface DriveUploadResult {
  fileId: string;
  webViewLink?: string;
}

/** Cloudinary URL から Google Drive へ同期（未設定時は null を返す） */
export async function syncPhotoToDrive(params: {
  imageUrl: string;
  eventId: string;
  venue?: string;
  start?: string;
  fileName?: string;
}): Promise<DriveUploadResult | null> {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) return null;

    const res = await fetch('/api/uploadToDrive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (res.status === 503) return null;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Drive sync failed:', err);
      return null;
    }

    const data = await res.json() as { fileId?: string; webViewLink?: string };
    if (!data.fileId) return null;
    return { fileId: data.fileId, webViewLink: data.webViewLink };
  } catch (e) {
    console.warn('Drive sync error:', e);
    return null;
  }
}

export async function deleteStoredPhoto(photo: EventPhoto): Promise<void> {
  if (!photo.storagePath) return;
  try {
    // サーバーAPIは Firebase ID トークン検証を要求する（未ログインでは削除不可）
    const token = await auth?.currentUser?.getIdToken();
    if (!token) {
      console.warn('Cloudinary deletion skipped: not authenticated');
      return;
    }
    await fetch('/api/deletePhoto', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publicId: photo.storagePath }),
    });
  } catch (e) {
    console.warn('Cloudinary deletion failed:', e);
  }
}
