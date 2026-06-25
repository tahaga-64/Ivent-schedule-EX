/** カタカナ→ひらがな変換（U+30A1–U+30F6 を 0x60 シフト。長音符・漢字・英数はそのまま） */
export function katakanaToHiragana(input: string): string {
  return input.replace(/[ァ-ヶ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/**
 * かな検索用の正規化。
 * - NFKC で全角/半角を統一（半角カナ ﾃ→テ、全角英数 Ａ→A 等）
 * - カタカナ→ひらがな
 * - 小文字化・空白除去
 * これにより「ひらがな / カタカナ / 半角カナ / 英大小」の差を吸収して部分一致できる。
 */
export function normalizeKana(input: string | null | undefined): string {
  if (!input) return '';
  return katakanaToHiragana(input.normalize('NFKC')).toLowerCase().replace(/\s+/g, '');
}

// ひらがな・カタカナ（全角/半角、濁点/半濁点・長音符含む）・空白のみ
const KANA_ONLY_RE = /^[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾟ\s]+$/;

/** 文字列が（長音符・空白を含め）かな文字のみで構成されているか */
export function isKanaOnly(input: string): boolean {
  return !!input && KANA_ONLY_RE.test(input);
}
