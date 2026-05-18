# 開発部門

## 役割
機能実装・設計書作成・デバッグ・コードレビューを担当する。
React 19 + TypeScript + Vite + Firebase のスタックで開発する。

## 技術スタック
- React 19.0.1 / TypeScript 5.8.2
- Vite 6.2.3（ビルドツール）
- Tailwind CSS 4.1.14 / Framer Motion 12.23.24
- Firebase Firestore / Firebase Auth
- @google/genai 1.29.0（AI機能）

## ルール
- 技術ドキュメントは `docs/topic-name.md`
- デバッグログは `debug-log/YYYY-MM-DD-issue-name.md`
- デバッグのステータス: open → investigating → resolved → closed
- TypeScriptの型エラーは解消してからマージする（`npm run lint` を確認）
- Firestore onSnapshot の購読は適切にクリーンアップする
- コンポーネントは `src/components/` に配置し、責務を分割する
- 意思決定（設計方針変更等）は secretary/notes/ に意思決定ログとして残す
- 既知の問題: `src/components/PreparationList.tsx` の Save アイコン未インポート

## ファイル命名
- 技術ドキュメント: `docs/topic-name.md`
- デバッグログ: `debug-log/YYYY-MM-DD-issue-name.md`

## フォルダ構成
- `docs/` - 技術ドキュメント・設計書
- `debug-log/` - デバッグ・バグ調査ログ
