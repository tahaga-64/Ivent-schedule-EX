import { EventPhoto } from '../types';
import { auth } from './firebase';

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;

export const GOOGLE_DRIVE_FOLDER_ID = '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';
export const GOOGLE_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`;

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

/** Cloudinary へアップロード（アプリ内表示用） */
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

/**
 * Drive 画像の表示URL。
 * フォルダがリンク共有（公開）されている前提で、Google のCDNを直接参照する
 * （Vercelプロキシを経由しないため高速・キャッシュも効く）。
 * 万一フォルダが非公開だと表示できないが、その場合は /api/driveImage プロキシに戻す。
 */
export function driveImageUrl(fileId: string, size: 'thumb' | 'full' = 'full'): string {
  const w = size === 'thumb' ? 500 : 1600;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${w}`;
}

/** EventPhoto の表示URL（Drive 優先・無ければ従来 Cloudinary にフォールバック＝ハイブリッド） */
export function photoDisplayUrl(photo: EventPhoto, size: 'thumb' | 'full' = 'full'): string {
  if (photo.driveFileId) return driveImageUrl(photo.driveFileId, size);
  return size === 'thumb' ? (photo.thumbnailUrl || photo.url) : photo.url;
}

export async function deleteStoredPhoto(photo: EventPhoto): Promise<void> {
  if (!photo.storagePath) return;
  try {
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

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink?: string;
  folderId: string;
}

/** fetch 失敗時に「(HTTP xxx) 詳細」形式の診断メッセージを作る */
async function describeFetchError(res: Response, fallback: string): Promise<string> {
  let detail = '';
  try {
    const body = await res.clone().json();
    detail = (body as { error?: string }).error ?? '';
  } catch {
    detail = (await res.text().catch(() => '')).slice(0, 140);
  }
  return `(HTTP ${res.status}) ${detail || fallback}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('ログインが必要です');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function listDriveFolders(parentId?: string): Promise<{ parentId: string; folders: DriveFolder[] }> {
  const headers = await authHeaders();
  const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const res = await fetch(`/api/listDriveFolders${qs}`, { headers });
  if (!res.ok) throw new Error(await describeFetchError(res, 'フォルダ一覧の取得に失敗しました'));
  return res.json();
}

export async function createDriveFolder(name: string, parentId?: string): Promise<DriveFolder & { webViewLink?: string }> {
  const headers = await authHeaders();
  const res = await fetch('/api/createDriveFolder', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'フォルダの作成に失敗しました');
  }
  const data = await res.json() as { id: string; name: string; webViewLink?: string };
  return { id: data.id, name: data.name, webViewLink: data.webViewLink };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

/** Cloudinary URL から Google Drive へ同期（未設定時は null） */
export async function syncPhotoToDrive(params: {
  imageUrl: string;
  eventId: string;
  targetFolderId: string;
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

    const data = await res.json() as { fileId?: string; webViewLink?: string; folderId?: string };
    if (!data.fileId || !data.folderId) return null;
    return { fileId: data.fileId, webViewLink: data.webViewLink, folderId: data.folderId };
  } catch (e) {
    console.warn('Drive sync error:', e);
    return null;
  }
}

/** ファイルを直接 Google Drive へアップロード */
export async function uploadToDriveFile(params: {
  eventId: string;
  file: File;
  targetFolderId: string;
}): Promise<DriveUploadResult> {
  const fileData = await fileToBase64(params.file);
  const headers = await authHeaders();
  const res = await fetch('/api/uploadToDrive', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventId: params.eventId,
      targetFolderId: params.targetFolderId,
      fileName: params.file.name,
      mimeType: params.file.type || 'image/jpeg',
      fileData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Driveへのアップロードに失敗しました');
  }

  const data = await res.json() as { fileId: string; webViewLink?: string; folderId: string };
  return { fileId: data.fileId, webViewLink: data.webViewLink, folderId: data.folderId };
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  width: number | null;
  height: number | null;
}

/** フォルダ直下の画像ファイル一覧（アルバムの Drive ミラー用） */
export async function listDriveFiles(
  folderId?: string,
  pageToken?: string,
): Promise<{ folderId: string; files: DriveFile[]; nextPageToken: string | null }> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (folderId) params.set('folderId', folderId);
  if (pageToken) params.set('pageToken', pageToken);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/listDriveFiles${qs}`, { headers });
  if (!res.ok) throw new Error(await describeFetchError(res, '画像一覧の取得に失敗しました'));
  return res.json();
}

/** Google Drive へ直接アップロードして EventPhoto を作成（Cloudinary 不使用・新方式） */
export async function uploadEventPhotoToDrive(
  eventId: string,
  file: File,
  targetFolderId: string,
): Promise<EventPhoto> {
  const result = await uploadToDriveFile({ eventId, file, targetFolderId });
  return {
    id: crypto.randomUUID(),
    url: driveImageUrl(result.fileId, 'full'),
    thumbnailUrl: driveImageUrl(result.fileId, 'thumb'),
    uploadedAt: new Date().toISOString(),
    driveFileId: result.fileId,
    driveFolderId: result.folderId,
    driveViewUrl: result.webViewLink,
  };
}

export async function deleteDriveFile(driveFileId: string): Promise<void> {
  try {
    const headers = await authHeaders();
    await fetch('/api/deleteDriveFile', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ driveFileId }),
    });
  } catch (e) {
    console.warn('Drive file deletion failed:', e);
  }
}

export async function registerTrackingNumber(trackingNumber: string, carrierCode?: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/registerTracking', {
      method: 'POST',
      headers,
      body: JSON.stringify({ trackingNumber, carrierCode }),
    });
    if (res.status === 503) return false;
    return res.ok;
  } catch {
    return false;
  }
}
