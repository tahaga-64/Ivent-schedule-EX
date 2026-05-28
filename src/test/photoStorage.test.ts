import { describe, it, expect } from 'vitest';
import { validateImageFile, MAX_PHOTOS, MAX_SIZE_BYTES } from '../lib/photoStorage';

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

describe('定数', () => {
  it('MAX_PHOTOS は 5', () => {
    expect(MAX_PHOTOS).toBe(5);
  });

  it('MAX_SIZE_BYTES は 10MB', () => {
    expect(MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
