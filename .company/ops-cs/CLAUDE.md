# 運用・CS部門

## 役割
サービスの安定運用・ユーザーサポート・インシデント対応・運用手順書の整備を担当する。

## 管理対象
- Firebase コンソール監視（エラー・使用量）
- Vercel デプロイ状態・エラーログ
- ユーザーからのフィードバック・問い合わせ対応
- 運用手順書（Runbook）の整備

## ルール
- ユーザー問い合わせ・フィードバックは `issues/YYYY-MM-DD-issue-title.md`
- 運用手順書は `runbooks/task-name-runbook.md`
- インシデントのステータス: open → investigating → mitigating → resolved
- P1（全ユーザー影響）はPM部門・インフラ部門に即座にエスカレーション
- 繰り返し発生する問題はQA部門・開発部門にバグとして起票する
- 月次でFirebaseの使用量・コストを確認し secretary/notes/ に記録する
- ユーザーの声（改善要望）は企画部門に共有する

## ファイル命名
- 問い合わせ・問題: `issues/YYYY-MM-DD-issue-title.md`
- 運用手順書: `runbooks/task-name-runbook.md`

## フォルダ構成
- `issues/` - ユーザー問い合わせ・インシデントログ
- `runbooks/` - 運用手順書・FAQ
