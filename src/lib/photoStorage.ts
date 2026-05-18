// Photos are stored as base64 data URLs directly in Firestore (no Firebase Storage required)

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
export const MAX_PHOTOS = 3;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return '対応画像形式: JPEG, PNG, WebP, GIF, HEIC';
  if (file.size > MAX_SIZE_BYTES) return 'ファイルサイズは10MB以下にしてください';
  return null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function resizeToDataUrl(file: File, maxWidth: number, quality: number): Promise<string> {
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
          blobToDataUrl(blob).then(resolve, reject);
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

export async function compressPhoto(file: File): Promise<{ url: string; thumbnailUrl: string }> {
  const [url, thumbnailUrl] = await Promise.all([
    resizeToDataUrl(file, 800, 0.82),
    resizeToDataUrl(file, 200, 0.75),
  ]);
  return { url, thumbnailUrl };
}
