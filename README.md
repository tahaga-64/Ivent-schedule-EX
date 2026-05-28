# EX Event Manager

> EX事業部向けのイベント管理 Web アプリ。スプレッドシート運用を脱却し、リアルタイム共有・モバイル対応・通知機能を備えたサーバーレス SPA として再設計。

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)](https://vercel.com/)

---

## デモ

| デモ URL | スクリーンショット |
|----------|------------------|
| 🔗 [Coming Soon](#) | 📸 [Coming Soon](#) |

> スクリーンショット・録画は近日追加予定

---

## 背景と課題

EX事業部では、イベントの日程管理・準備物の確認をスプレッドシートで運用していました。しかし現場では以下の問題が慢性化していました。

| 課題 | 内容 |
|------|------|
| 情報の視認性 | 多数のセルが並ぶシートから必要な情報を探しにくい |
| 更新漏れ | 複数人が同じファイルを編集することで上書き・見落しが発生 |
| 状況共有 | 準備の進捗状態をリアルタイムに把握できない |
| モバイル非対応 | スマホでの閲覧・操作が実用に耐えない |

既存の従業員向けスケジュールアプリの開発経験を踏まえ、**「イベント管理もアプリ化したい」** という現場の要望から本プロジェクトを開始しました。

---

## コンセプト

**「現場で使いやすいイベント管理」**

単なるデジタル化ではなく、現場スタッフが日常的に使い続けられる体験を目指しました。

- **視認性** — ステータスカラー・進捗バーで状況を一目で把握
- **操作性** — 直感的な UI / モバイル FAB によるすばやい操作
- **リアルタイム共有** — Firestore onSnapshot で全員の画面が即時反映
- **モバイル対応** — 月/週カレンダーのモバイル最適化レイアウト
- **UI 体験** — ダークモード対応 / アニメーション付きトランジション

---

## 主な機能

### イベント管理
- イベントの作成 / 編集 / 削除（権限管理付き）
- 6種類のステータス管理（予定 / 準備中 / 入荷待ち / 準備完了 / 終了 / キャンセル）
- ステータスフィルター
- 担当者割り当て（スタッフリストから選択）
- 詳細メモ（全スタッフ記入可）

### カレンダービュー
- 月表示 / 週表示（モバイル最適化）
- ステータスカラー付きイベントチップ
- 準備物進捗バー（カレンダーチップ・PC ホバー）
- モバイル FAB（フローティングアクションボタン）

### 準備物チェックリスト
- 準備物の登録・編集・削除
- 入荷済み / 準備完了の個別チェック
- **進捗率の自動算出**（Firestore 側で整合性管理）

### 写真アルバム
- イベントごとの写真管理（最大5枚）
- Cloudinary によるクラウドストレージ
- キャプション付き縦スクロールアルバム UI
- 削除時の Cloudinary からの完全パージ

### 通知
- アプリ内通知（Firestore サブコレクション）
- Web Push 通知（FCM / Service Worker）

### 認証・権限管理
- Google ログイン（Firebase Authentication）
- Firestore `allowedUsers` コレクションによる招待制アクセス制限
- 編集権限 / 閲覧権限の分離

---

## 技術スタック

### フロントエンド

| 技術 | バージョン | 採用理由 |
|------|-----------|----------|
| React | 19 | Concurrent Features・hooks エコシステムの安定性 |
| TypeScript | 5 | 型安全による保守性向上・チーム開発への拡張性 |
| Vite | 6 | 高速 HMR・ESM ネイティブビルドで DX を最大化 |
| Tailwind CSS | 4 | CSS Variables ネイティブ対応でダークモードをセマンティックに実装 |
| motion/react | 12 | Framer Motion の React 19 対応版。宣言的アニメーション |
| Lucide React | — | 軽量・統一感のある SVG アイコンセット |
| Recharts | 3 | React ネイティブなグラフコンポーネント |

### バックエンド / インフラ

| 技術 | 採用理由 |
|------|----------|
| Firebase Firestore | onSnapshot によるリアルタイム同期・サーバーレス運用コストゼロ |
| Firebase Auth | Google OAuth をゼロ実装で導入、allowedUsers による独自制限も容易 |
| Firebase Cloud Messaging | Web Push を Firebase エコシステム内で完結させ、複数サービス管理を回避 |
| Cloudinary | 画像の最適化・変換・CDN 配信を API 1本で解決 |
| Vercel | GitHub 連携による自動デプロイ・Serverless Functions との統合 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────┐
│               Browser (SPA)                  │
│   React 19 + TypeScript + Tailwind CSS 4     │
│   Vite 6 ビルド / motion/react アニメーション  │
└───────────────┬─────────────────────────────┘
                │ Firestore onSnapshot（リアルタイム）
                │ Firebase Auth（Google OAuth）
                │ FCM（Web Push）
┌───────────────▼─────────────────────────────┐
│              Firebase                        │
│   Firestore │ Auth │ Cloud Messaging         │
└─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│         Vercel Serverless Functions          │
│   /api/notify  ── FCM 管理者プッシュ送信      │
│   /api/deletePhoto ── Cloudinary パージ      │
└─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│              Cloudinary                      │
│   写真アップロード / 最適化 / CDN 配信         │
└─────────────────────────────────────────────┘
```

**設計上のポイント**
- **Monolithic SPA**（`src/App.tsx` 中心）: チーム規模・用途に合わせてオーバーエンジニアリングを避けた意図的な選択
- **Firestore セキュリティルール**でサーバーサイドのアクセス制御を実装
- **セマンティックカラートークン**（`--color-success` 等 CSS Variables）+ Tailwind `dark:` でライト/ダーク双方のテーマを一元管理

---

## CI/CD・デプロイフロー

```
git push (main ブランチ)
        │
        ▼
 Vercel 自動ビルド
  └── vite build
  └── Serverless Functions デプロイ (/api/*)
        │
        ▼
 本番環境へ自動反映（Vercel CDN）
```

- **ブランチ戦略**: `main` ブランチへのプッシュで本番自動デプロイ
- **プレビューデプロイ**: Pull Request ごとに Vercel がプレビュー URL を発行（予定）
- **型チェック**: `npm run lint`（`tsc --noEmit`）でビルド前の型エラーを検出

---

## ローカル開発

```bash
# リポジトリをクローン
git clone https://github.com/your-username/Ivent-schedule-EX.git
cd Ivent-schedule-EX

# 依存関係をインストール
npm install

# 環境変数を設定（下記「環境変数」セクション参照）
cp .env.example .env.local

# 開発サーバー起動（http://localhost:3000）
npm run dev

# 型チェック
npm run lint

# プロダクションビルド
npm run build
```

---

## 環境変数

### フロントエンド（`.env.local`）

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

### サーバーサイド（Vercel 環境変数）

| 変数名 | 説明 |
|--------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK サービスアカウント JSON |
| `CLOUDINARY_API_KEY` | Cloudinary API キー |
| `CLOUDINARY_API_SECRET` | Cloudinary API シークレット |

---

## ログイン制限のセットアップ

Firebase Console → Firestore Database で `allowedUsers` コレクションを作成し、
アクセスを許可するユーザーのメールアドレスをドキュメント ID として追加してください。

```
allowedUsers/
  user@example.com   ← ドキュメント ID がメールアドレス
```

---

## ディレクトリ構成（抜粋）

```
src/
├── App.tsx                  # ルートコンポーネント・状態管理
├── components/              # UI コンポーネント
│   ├── notifications/       # 通知関連
│   └── photos/              # 写真アルバム関連
├── hooks/                   # カスタム Hooks
│   ├── useNotifications.ts
│   └── usePhotos.ts
├── lib/                     # Firebase / Cloudinary 初期化・ユーティリティ
│   ├── firebase.ts
│   ├── fcm.ts
│   ├── permissions.ts
│   └── photoStorage.ts
└── types.ts                 # 型定義
api/
├── notify.ts                # Vercel Serverless: FCM プッシュ送信
└── deletePhoto.ts           # Vercel Serverless: Cloudinary パージ
```

---

## Development Flow

本プロジェクトは AI ツールを積極的に活用した開発プロセスで構築しています。

| フェーズ | 使用ツール |
|----------|-----------|
| 要件整理・設計 | Claude（Anthropic） |
| 初期プロトタイプ生成 | Google AI Studio |
| UI 改善・機能実装 | Cursor |

> AI を補助ツールとして位置付け、技術選定・アーキテクチャ判断・コードレビューは自身で行いながら現場課題へのフィットを優先して開発を継続しています。

---

## 今後の展望

- [ ] テストコード導入（Vitest + Testing Library）
- [ ] Storybook によるコンポーネントカタログ整備
- [ ] Firestore セキュリティルールの強化
- [ ] プレビューデプロイ（PR ごとの Vercel プレビュー）
- [ ] パフォーマンス計測・Core Web Vitals 改善

---

## ライセンス

Private — EX事業部内利用に限定。
