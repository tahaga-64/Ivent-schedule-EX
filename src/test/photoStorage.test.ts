import { describe, it, expect } from 'vitest';
import { validateImageFile, MAX_PHOTOS, MAX_SIZE_BYTES, driveImageUrl, photoDisplayUrl } from '../lib/photoStorage';
import type { EventPhoto } from '../types';

function makeFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

describe('validateImageFile', () => {
  it('JPEGファイルはnullを返す（OK）', () => {
    expect(validateImageFile(makeFile('photo.jpg', 'image/jpeg'))).toBeNull();
  });

  it('PNGファイルはnullを返す', () => {
    expect(validateImageFile(makeFile('photo.png', 'image/png'))).toBeNull();
  });

  it('HEICはnullを返す（拡張子チェック）', () => {
    expect(validateImageFile(makeFile('photo.heic', 'image/heic'))).toBeNull();
  });

  it('PDFはエラーメッセージを返す', () => {
    const result = validateImageFile(makeFile('doc.pdf', 'application/pdf'));
    expect(result).toBe('画像ファイルを選択してください');
  });

  it('10MB超過はエラーメッセージを返す', () => {
    const bigFile = makeFile('big.jpg', 'image/jpeg', MAX_SIZE_BYTES + 1);
    expect(validateImageFile(bigFile)).toBe('ファイルサイズは10MB以下にしてください');
  });

  it('ちょうど10MBはOK', () => {
    const file = makeFile('ok.jpg', 'image/jpeg', MAX_SIZE_BYTES);
    expect(validateImageFile(file)).toBeNull();
  });
});

describe('driveImageUrl', () => {
  it('Drive プロキシのURLを生成（full 既定）', () => {
    expect(driveImageUrl('abc123')).toBe('/api/driveImage?id=abc123&size=full');
  });
  it('thumb サイズを指定できる', () => {
    expect(driveImageUrl('abc123', 'thumb')).toBe('/api/driveImage?id=abc123&size=thumb');
  });
  it('id をURLエンコードする', () => {
    expect(driveImageUrl('a/b c')).toBe('/api/driveImage?id=a%2Fb%20c&size=full');
  });
});

describe('photoDisplayUrl（ハイブリッド）', () => {
  const base = (o: Partial<EventPhoto>): EventPhoto => ({
    id: 'p', url: 'https://cdn/full', thumbnailUrl: 'https://cdn/thumb',
    uploadedAt: '2026-01-01T00:00:00Z', ...o,
  });

  it('driveFileId があれば Drive プロキシURLを使う', () => {
    const p = base({ driveFileId: 'drive1' });
    expect(photoDisplayUrl(p, 'full')).toBe('/api/driveImage?id=drive1&size=full');
    expect(photoDisplayUrl(p, 'thumb')).toBe('/api/driveImage?id=drive1&size=thumb');
  });

  it('driveFileId が無ければ従来 Cloudinary にフォールバック', () => {
    const p = base({});
    expect(photoDisplayUrl(p, 'full')).toBe('https://cdn/full');
    expect(photoDisplayUrl(p, 'thumb')).toBe('https://cdn/thumb');
  });

  it('thumb 指定で thumbnailUrl が無ければ url にフォールバック', () => {
    const p = base({ thumbnailUrl: undefined });
    expect(photoDisplayUrl(p, 'thumb')).toBe('https://cdn/full');
  });
});

describe('定数', () => {
  it('MAX_PHOTOS は 5', () => {
    expect(MAX_PHOTOS).toBe(5);
  });

  it('MAX_SIZE_BYTES は 10MB', () => {
    expect(MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
