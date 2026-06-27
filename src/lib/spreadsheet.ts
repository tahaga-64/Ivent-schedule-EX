/** スプレッドシート（.xlsx）出力の共通ユーティリティ。SheetJS(xlsx) を動的 import で利用 */

export type SheetRow = Record<string, string | number>;

/** ファイル名に使えない文字を除去 */
export function sanitizeFilename(name: string): string {
  return (name || 'export').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

/**
 * 行データを xlsx として書き出してダウンロードする。
 * @param sheetName シート名
 * @param filename 拡張子込みのファイル名（例: "発注リスト.xlsx"）
 * @param rows json_to_sheet に渡す行（キー＝列見出し）
 * @param colWidths 各列の幅（wch）。省略時は自動
 */
export async function exportRowsToXlsx(
  sheetName: string,
  filename: string,
  rows: SheetRow[],
  colWidths?: number[],
): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) ws['!cols'] = colWidths.map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // シート名は31文字まで
  XLSX.writeFile(wb, filename);
}

/**
 * 複数シートをまとめて1つの xlsx として書き出す。
 * @param sheets [{ name, rows, colWidths? }]
 * @param filename 拡張子込みのファイル名
 */
export async function exportSheetsToXlsx(
  sheets: { name: string; rows: SheetRow[]; colWidths?: number[] }[],
  filename: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  sheets.forEach((s, i) => {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    if (s.colWidths) ws['!cols'] = s.colWidths.map(wch => ({ wch }));
    // シート名は31文字まで・重複不可
    let name = (s.name || `Sheet${i + 1}`).slice(0, 31);
    while (used.has(name)) name = name.slice(0, 28) + '_' + i;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename);
}
