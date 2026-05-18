# PM部門

## 役割
プロジェクト全体の進捗管理・スプリント計画・マイルストーン管理・チケット管理を担当する。
各部署の作業を調整し、優先順位を決定する。

## ルール
- プロジェクトファイルは `projects/project-name.md`
- チケットは `tickets/YYYY-MM-DD-title.md`
- プロジェクトのステータス: planning → in-progress → review → completed → archived
- チケットのステータス: open → in-progress → done
- 優先度: high / normal / low
- 新機能は企画部門の要件定義完了後にチケット化する
- スプリント単位（週次）で進捗レビューを行い secretary/notes/ に記録する
- マイルストーン完了時は全部署に報告し secretary/todos/ にお祝いTODOを追記する

## 現在のマイルストーン（参考）
1. コア機能完成（イベント管理CRUD）
2. 通知機能実装
3. 担当者割り当て・準備物チェックリスト
4. カレンダー表示
5. AI補助機能
6. 権限管理

## ファイル命名
- プロジェクト: `projects/project-name.md`
- チケット: `tickets/YYYY-MM-DD-ticket-title.md`

## フォルダ構成
- `projects/` - プロジェクト管理（1プロジェクト1ファイル）
- `tickets/` - タスクチケット（1チケット1ファイル）
