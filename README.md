# EX Event Manager

EX事業部向けのイベント管理アプリ。
従来スプレッドシートで管理していたイベント日程・準備物・担当者管理を、リアルタイム共有可能なWebアプリとして再設計。

⸻

## 背景

EX事業部では、イベントの日程管理や準備物の確認をスプレッドシートで運用していましたが、

- 情報が見づらい
- 更新漏れが発生しやすい
- 状況共有が難しい
- スマホで扱いづらい

などの課題がありました。

もともと従業員向けスケジュールアプリを制作した経験から、
「イベント管理もアプリ化できないか」という要望を受け、本プロジェクトを開発しています。

⸻

## コンセプト

「現場で使いやすいイベント管理」

- 視認性
- 操作性
- リアルタイム共有
- モバイル対応
- ダークモードを含むUI体験

を重視した設計を目指しています。

⸻

## 主な機能

### イベント管理
- イベント作成 / 編集 / 削除（権限管理付き）
- イベントステータス管理（予定 / 準備中 / 入荷待ち / 準備完了 / 終了 / キャンセル）
- ステータスフィルター
- 担当者割り当て（スタッフリストから選択）
- 詳細メモ（全スタッフ記入可）

### カレンダー
- 月表示 / 週表示（モバイル最適化）
- 日付の視認性改善（曜日カラー対応）
- イベントチップへのステータスカラー表示
- 準備物進捗バー（カレンダーチップ・PCホバー）
- モバイルFAB（新規イベント作成ボタン）

### 準備物チェックリスト
- 準備物の登録・編集・削除
- 入荷済み / 準備完了の個別チェック
- 進捗率の自動算出

### 写真アルバム
- イベントごとの写真管理（最大5枚）
- Cloudinaryによるクラウドストレージ
- キャプション付き縦スクロールアルバムUI
- 削除時のCloudinaryからの完全削除

### 通知
- アプリ内通知（Firestore）
- プッシュ通知（FCM / Web Push）

### 認証・権限管理
- Googleログイン（Firebase Authentication）
- Firestore `allowedUsers` コレクションによるログイン制限
- 編集権限・閲覧権限の分離

⸻

## 技術スタック

### フロントエンド
- React 19
- TypeScript 5
- Vite 6（ビルドツール）
- Tailwind CSS 4
- motion/react（Framer Motion）
- Lucide React（アイコン）

### バックエンド / インフラ
- Firebase Firestore（リアルタイムデータベース）
- Firebase Auth（認証 / Google OAuth）
- Firebase Cloud Messaging（プッシュ通知）
- Cloudinary（写真ストレージ）
- Vercel（ホスティング + Serverless Functions）

⸻

## 環境変数

### フロントエンド（Vercel / `.env.local`）

| 変数名 | 説明 |
|--------|------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API キー |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン |
| `VITE_FIREBASE_PROJECT_ID` | Firebase プロジェクト ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage バケット |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM 送信者 ID |
| `VITE_FIREBASE_APP_ID` | Firebase アプリ ID |
| `VITE_FIREBASE_DATABASE_ID` | Firestore データベース ID（通常 `(default)`） |
| `VITE_FIREBASE_VAPID_KEY` | Web Push 公開鍵 |

### サーバーサイド（Vercel のみ）

| 変数名 | 説明 |
|--------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK サービスアカウント JSON |
| `CLOUDINARY_API_KEY` | Cloudinary API キー |
| `CLOUDINARY_API_SECRET` | Cloudinary API シークレット |

⸻

## ログイン制限の設定

Firebase Console → Firestore Database で `allowedUsers` コレクションを作成し、
許可するユーザーのメールアドレスをドキュメント ID として追加してください。

```
allowedUsers/
  user@example.com  ← ドキュメントID がメールアドレス
```

⸻

## Architecture

- Monolithic SPA（`src/App.tsx` 中心）
- Firestore `onSnapshot` によるリアルタイム同期
- Firebase 中心のサーバーレス構成
- Vercel Serverless Functions（`/api/notify`, `/api/deletePhoto`）
- CSS Variables + Tailwind `dark:` によるテーマ切替
- セマンティックカラートークン（`--color-success` 等）

⸻

## Development Flow

- Claude を用いた要件整理・設計・実装
- Google AI Studio による初期プロトタイプ生成
- Cursor を活用したUI改善・機能実装

AIを補助的に活用しながら、現場課題に合わせた改善を継続中。
