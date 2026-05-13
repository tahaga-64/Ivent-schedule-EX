import { uploadEventPhoto, deleteEventPhoto } from './firebase';
import { EventPhoto } from '../types';

export interface PhotoUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg';
}

export async function compressImage(
  file: File,
  options: PhotoUploadOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = 'webp'
  } = options;

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File(
              [blob],
              `${file.name.split('.')[0]}.${format}`,
              { type: `image/${format}` }
            );
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        `image/${format}`,
        quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
}

export async function uploadAndCompressPhoto(
  eventId: string,
  file: File,
  photoId: string,
  options?: PhotoUploadOptions
): Promise<EventPhoto> {
  const compressedFile = await compressImage(file, options);
  const { url, storagePath } = await uploadEventPhoto(eventId, compressedFile, photoId);

  return {
    id: photoId,
    url,
    storagePath,
    uploadedAt: new Date().toISOString(),
    caption: ''
  };
}

export async function deletePhoto(photo: EventPhoto): Promise<void> {
  await deleteEventPhoto(photo.storagePath);
}

export function generatePhotoId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!isImageFile(file)) {
    return { valid: false, error: '画像ファイルのみ対応しています' };
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    return { valid: false, error: 'ファイルサイズは10MB以下にしてください' };
  }

  return { valid: true };
}