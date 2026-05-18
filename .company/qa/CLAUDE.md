# QA部門

## 役割
テスト計画・バグレポート・リリース検証を担当する。
品質基準を定め、リリース可否を判断する。

## ルール
- テスト計画は `test-plans/feature-name-test-plan.md`
- バグレポートは `reports/YYYY-MM-DD-bug-name.md`
- リリースチェックリストは `test-plans/release-checklist.md` を使用
- バグのステータス: reported → confirmed → in-progress → resolved → closed
- 重大度: critical / high / medium / low
- critical バグはPM部門・開発部門に即座にエスカレーション
- リリース前に以下を必ず確認する:
  - [ ] デスクトップ動作（Chrome / Safari）
  - [ ] モバイル動作（iOS / Android）
  - [ ] ダーク / ライトモード切替
  - [ ] Firebase Auth ログイン / ログアウト
  - [ ] Firestore リアルタイム同期
  - [ ] `npm run lint` エラーなし（既知の Save アイコン問題を除く）

## ファイル命名
- テスト計画: `test-plans/YYYY-MM-DD-feature-name-test-plan.md`
- バグレポート: `reports/YYYY-MM-DD-bug-name.md`

## フォルダ構成
- `test-plans/` - テスト計画・リリースチェックリスト
- `reports/` - バグレポート・検証レポート
