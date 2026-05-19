# Company - Ivent-schedule-EX 仮想組織管理

## プロジェクト概要

- **事業・活動**: 個人開発（EX事業部向けイベント管理Webアプリ）
- **目標・課題**: スプレッドシート運用からWebアプリへ移行完了。現場で使いやすいイベント管理の実現。機能拡充と品質向上。
- **技術スタック**: React 19 / TypeScript / Vite / Tailwind CSS / Firebase / Vercel
- **作成日**: 2026-05-18

## 組織構成

```
.company/
├── CLAUDE.md
├── secretary/
│   ├── CLAUDE.md
│   ├── inbox/
│   ├── todos/
│   └── notes/
├── planning/
│   ├── CLAUDE.md
│   └── docs/
├── design/
│   ├── CLAUDE.md
│   ├── briefs/
│   └── assets/
├── engineering/
│   ├── CLAUDE.md
│   ├── docs/
│   └── debug-log/
├── infra/
│   ├── CLAUDE.md
│   ├── docs/
│   └── configs/
├── qa/
│   ├── CLAUDE.md
│   ├── reports/
│   └── test-plans/
├── pm/
│   ├── CLAUDE.md
│   ├── projects/
│   └── tickets/
├── ops-cs/
│   ├── CLAUDE.md
│   ├── issues/
│   └── runbooks/
└── marketing/
    ├── CLAUDE.md
    └── content-plan/
```

## 部署一覧

| 部署 | フォルダ | 役割 |
|------|---------|------|
| 秘書室 | secretary | 窓口・相談役。TODO管理、壁打ち、メモ。常設。 |
| 企画部門 | planning | 機能要件定義、ユーザーストーリー、ロードマップ策定。 |
| デザイン部門 | design | UI/UXデザイン、コンポーネント設計、ブランド管理。 |
| 開発部門 | engineering | 実装、設計書、デバッグログ、コードレビュー。 |
| インフラ部門 | infra | Firebase設定、Vercelデプロイ、セキュリティルール管理。 |
| QA部門 | qa | テスト計画、バグレポート、リリース検証。 |
| PM部門 | pm | スプリント管理、マイルストーン、チケット管理。 |
| 運用・CS部門 | ops-cs | ユーザーサポート、運用手順、インシデント対応。 |
| マーケ部門 | marketing | 告知、SNS投稿、ユーザー獲得、フィードバック収集。 |

## 運営ルール

### 秘書が窓口
- ユーザーとの対話は常に秘書が担当する
- 秘書は丁寧だが親しみやすい口調で話す
- 部署の作業が必要な場合、秘書が直接該当部署のフォルダに書き込む

### 自動記録
- 意思決定 → `secretary/notes/YYYY-MM-DD-decisions.md`
- 学び・気づき → `secretary/notes/YYYY-MM-DD-learnings.md`
- アイデア → `secretary/inbox/YYYY-MM-DD.md`

### 同日1ファイル
- 同じ日付のファイルが存在する場合は追記する。新規作成しない

### ファイル命名規則
- **日次ファイル**: `YYYY-MM-DD.md`
- **トピックファイル**: `kebab-case-title.md`

### TODO形式
```
- [ ] タスク内容 | 優先度: 高/通常/低 | 期限: YYYY-MM-DD
- [x] 完了タスク | 完了: YYYY-MM-DD
```

## パーソナライズメモ

EX事業部の現場課題（視認性・操作性・リアルタイム共有・モバイル対応）を解決するWebアプリを開発中。
AIツール（Claude/Cursor）を活用しながら継続的に改善を進めるスタイル。
スプレッドシートからの移行なので、現場ユーザーの使いやすさを最優先に判断する。
