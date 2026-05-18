import { supabase, PHOTO_BUCKET } from './supabase';

export const MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
export const MAX_PHOTOS = 3;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return '対応画像形式: JPEG, PNG, WebP, GIF, HEIC';
  if (file.size > MAX_SIZE_BYTES) return 'ファイルサイズは10MB以下にしてください';
  return null;
}

export async function uploadToSupabase(
  file: File,
  storagePath: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  onProgress?.(10);
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  onProgress?.(90);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function deleteFromSupabase(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}
