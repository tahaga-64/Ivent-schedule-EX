# EX Event Manager

> EX事業部向けのイベント管理 Web アプリ。スプレッドシート運用を脱却し、**リアルタイム共有・モバイル対応・PWA** を備えたサーバーレス SPA。
> イベントの日程／準備物／担当者／写真／会場レイアウトを一元管理します。

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)](https://vercel.com/)

---

## 背景と課題

EX事業部ではイベントの日程・準備物の管理をスプレッドシートで運用していましたが、現場では **視認性の低さ・更新漏れ・リアルタイム共有の不足・モバイル非対応** が慢性的な問題でした。本アプリはこれらを解決し、現場スタッフが日常的に使い続けられる体験を目指して開発しています。

---

## 主な機能

### 🗓️ イベント管理
- イベントの作成 / 編集 / 削除（権限管理付き・デスクトップのみ）
- 6種類のステータス（予定 / 準備中 / 入荷待ち / 準備完了 / 終了 / キャンセル）＋ステータスフィルター
- 担当者割り当て（スタッフリストから選択）・日別役割・共有メモ（全員記入可）
- 会場・クライアント名での検索
- 起動時は常に **当月** を自動表示

### 📅 カレンダー / ホーム
- デスクトップ：月グリッドカレンダー（ステータスカラー・準備物進捗ホバー）
- モバイル：タイムライン / 日別アジェンダ（常駐カルーセルでシームレス遷移）
- ホーム：直近・開催中・期限超過のイベントを一覧

### 📋 準備物リスト
- 品名・数量・単価・配送料・URL・備考の登録、金額・進捗の自動算出
- **自動保存**（チェック・入力は即 Firestore に保存。手動保存ボタン不要）
- **Excel 出力 / 印刷 / 商談提案 PDF / LINE 共有**

### 📷 写真アルバム（イベント）
- イベントごとに最大5枚（1枚10MBまで）／ Cloudinary ストレージ
- 削除時はサーバー API 経由で Cloudinary からも完全削除（Firebase ID トークン認証）

### 🐟 魚リスト（水族館イベント）
- 観賞魚の種類・匹数・メモ管理（リアルタイム同期）

### 🗺️ フロアレイアウトプランナー
- ドラッグ＆ドロップで什器（机・水槽・砂場・入口…）を配置・回転
- **カスタムアイテム追加**（名前・絵文字・色を指定）
- **アイテムのサイズ変更**（拡大／縮小）
- **参考写真ギャラリー**（Cloudinary・最大12枚）
- **公開共有リンク**（`/?layout=<イベントID>`）— 未ログインのクライアントも閲覧可能

### 📦 備品マスター / 🗄️ アーカイブ
- よく使う備品のひな型管理／終了イベントの記録

### 📱 PWA
- `manifest.webmanifest` + Apple メタタグでホーム画面追加・スタンドアロン起動に対応

### 🔐 認証・権限
- Google / Apple / メールでログイン（Firebase Auth）
- `allowedUsers` コレクションによる**招待制**アクセス
- 編集権限の分離（下表）

---

## 権限モデル

| 操作 | 権限 |
|------|------|
| ログイン | `allowedUsers` に登録されたメールのみ |
| イベント本体の作成・編集・削除 | `permissions.ts` の `EVENT_EDITOR_EMAILS`、かつ**デスクトップのみ** |
| 準備物・写真・魚リスト・レイアウトの編集 | ログイン済みユーザー全員 |
| レイアウトの**閲覧** | 公開（共有リンク用・未ログイン可）。書き込みはログイン済みのみ |

> `EVENT_EDITOR_EMAILS`（`src/lib/permissions.ts`）と `firestore.rules` は常に揃えること。

---

## 技術スタック

| 領域 | 採用技術 |
|------|----------|
| フロントエンド | React 19 / TypeScript / Vite 6 |
| スタイル | Tailwind CSS v4（`@import "tailwindcss"`・CSS変数テーマトークン） |
| アニメーション | motion/react（Framer Motion v12） |
| アイコン | lucide-react |
| 帳票 | xlsx（Excel 出力）/ ブラウザ印刷（`@media print`） |
| バックエンド | Firebase（Firestore + Auth）|
| 画像 | Cloudinary（アップロード・最適化・CDN）|
| サーバーレス | Vercel Functions（`/api/deletePhoto`）|
| テスト | Vitest + Testing Library（23 ケース）|
| ホスティング | Vercel（`main` ブランチ自動デプロイ）|

> ℹ️ プッシュ通知は Cloudflare Worker + Web Push 方式です（`VITE_PUSH_WORKER_URL` / `VITE_WEB_PUSH_PUBLIC_KEY`）。セットアップは [`docs/free-push-notifications.md`](docs/free-push-notifications.md) を参照。

---

## コマンド

```bash
npm run dev      # 開発サーバー（http://localhost:3000）
npm run build    # プロダクションビルド（Vite）
npm run lint     # 型チェック（tsc --noEmit）
npm test         # テスト（vitest run）
```

---

## ローカル開発

```bash
git clone https://github.com/tahaga-64/Ivent-schedule-EX.git
cd Ivent-schedule-EX
npm install
cp .env.example .env.local   # 下記「環境変数」を設定
npm run dev
```

---

## 環境変数

### フロントエンド（`.env.local` / Vercel）
| 変数 | 説明 |
|------|------|
| `VITE_FIREBASE_API_KEY` 他 `VITE_FIREBASE_*` | Firebase Web 設定一式（API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID、必要に応じて DATABASE_ID） |

### サーバーサイド（Vercel 環境変数）
| 変数 | 説明 |
|------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK（`/api/deletePhoto` の ID トークン検証用）|
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary 削除 API 用 |

---

## Firestore コレクション

| コレクション | 用途 |
|---|---|
| `events` | イベント本体 |
| `events/{id}/preparationItems` | 準備物リスト |
| `events/{id}/fishItems` | 魚リスト（水族館）|
| `layouts/{eventId}` | フロアレイアウト（items / customItems / photos）。**読み取り公開**|
| `allowedUsers` | ログイン許可ユーザー |
| `staff` | スタッフリスト |
| `masterItems` | 備品マスター |
| `userProfiles` / `userRoles` | プロフィール / ロール |
| `appConfig/eventsMigration` | 静的DATA→Firestore 移行フラグ |

---

## データ移行（静的DATA → Firestore）

初期イベントは `src/constants.ts` の静的 `DATA` を起点とし、Firestore へ移行できます。

- アプリ上部の **「初期データを取り込む」** バナー（編集者・1回）で投入、または
- `FIREBASE_SERVICE_ACCOUNT_JSON` を設定して `npx tsx scripts/migrate-events.ts`

移行が完了すると `appConfig/eventsMigration.done` が立ち、アプリは Firestore を正として動作（削除も反映）します。

---

## デプロイ

```
git push origin HEAD:main  →  Vercel 自動ビルド (vite build + /api/*)  →  本番反映
```

> ⚠️ **Firestore セキュリティルール（`firestore.rules`）は Vercel では反映されません。**
> Firebase Console（Firestore → ルール）に貼り付けて公開するか、`npx firebase-tools deploy --only firestore:rules` で別途デプロイしてください。`layouts` を公開読み取りにしているため、共有リンクを使う場合はこのデプロイが必須です。

---

## ディレクトリ構成（抜粋）

```
src/
├── App.tsx                  # ルート・状態管理・ビュー切替・Firestore購読
├── types.ts / constants.ts / index.css
├── components/
│   ├── HomeView / CalendarView / CalendarComponents / MobileCalendarViews
│   ├── AppSidebar            # フィルター・スタッフ（デスクトップ）
│   ├── EventDetailModal      # イベント詳細（デスクトップは2カラム）
│   ├── PreparationList       # 準備物（自動保存・Excel/印刷/商談PDF/LINE）
│   ├── FishListView          # 魚リスト
│   ├── LayoutView            # フロアレイアウト（カスタム/サイズ/写真/共有）
│   ├── MasterItemsView / LoginScreen / AccessDeniedScreen / ProfileSetupScreen
│   └── photos/{PhotoUpload, PhotoGallery}
├── lib/{firebase, permissions, allowedUsers, photoStorage, eventHelpers}
├── hooks/{usePhotos, useRoles}
└── data/eventTypes
api/deletePhoto.ts           # Cloudinary 削除（Firebase ID トークン認証）
scripts/{migrate-events.ts, gen-icons.mjs}
firestore.rules              # セキュリティルール（要デプロイ）
public/manifest.webmanifest  # PWA
```

---

## ドキュメント

- **スタッフ向け利用ガイド**: `.company/ops-cs/runbooks/staff-user-guide.md`
- **運用手順書（管理者向け）**: `.company/ops-cs/runbooks/2026-05-25-operations-manual.md`
- **リリースチェックリスト**: `.company/ops-cs/runbooks/2026-06-01-release-checklist.md`

---

## ライセンス

Private — EX事業部内利用に限定。
