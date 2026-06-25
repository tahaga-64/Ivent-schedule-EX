import { describe, it, expect } from 'vitest';
import { normalizeKana, katakanaToHiragana, isKanaOnly } from '../lib/kana';

describe('normalizeKana', () => {
  it('カタカナとひらがなを同一視する', () => {
    expect(normalizeKana('テーブル')).toBe(normalizeKana('てーぶる'));
    expect(normalizeKana('テーブル')).toBe('てーぶる');
  });

  it('半角カナ・全角英数を吸収する', () => {
    expect(normalizeKana('ﾃｰﾌﾞﾙ')).toBe('てーぶる');
    expect(normalizeKana('ＵＳＢ')).toBe('usb');
  });

  it('空白除去・小文字化する', () => {
    expect(normalizeKana(' AB C ')).toBe('abc');
  });

  it('漢字+カナ名を読みで部分一致できる', () => {
    // 「折りたたみテーブル」を「てーぶる」で検索ヒット
    expect(normalizeKana('折りたたみテーブル').includes(normalizeKana('てーぶる'))).toBe(true);
  });

  it('null/undefined/空文字に安全', () => {
    expect(normalizeKana(undefined)).toBe('');
    expect(normalizeKana(null)).toBe('');
    expect(normalizeKana('')).toBe('');
  });
});

describe('katakanaToHiragana', () => {
  it('カタカナをひらがなへ変換する', () => {
    expect(katakanaToHiragana('カタカナ')).toBe('かたかな');
    expect(katakanaToHiragana('ヴ')).toBe('ゔ');
  });

  it('長音符・漢字・英数はそのまま', () => {
    expect(katakanaToHiragana('長机ーUSB')).toBe('長机ーUSB');
  });
});

describe('isKanaOnly', () => {
  it('かなのみは true', () => {
    expect(isKanaOnly('ながつくえ')).toBe(true);
    expect(isKanaOnly('テーブル')).toBe(true);
    expect(isKanaOnly('ﾃｰﾌﾞﾙ')).toBe(true);
  });

  it('漢字/英数を含むと false', () => {
    expect(isKanaOnly('長机')).toBe(false);
    expect(isKanaOnly('USBケーブル')).toBe(false);
    expect(isKanaOnly('')).toBe(false);
  });
});
