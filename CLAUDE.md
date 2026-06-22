# CLAUDE.md — Ivent-schedule-EX

EX事業部 イベント管理システム。イベントの日程・準備物・担当者・写真を一元管理する社内向けWebアプリ。

---

## コマンド

```bash
npm run dev      # 開発サーバー起動（localhost:3000）
npm run build    # プロダクションビルド（型チェック込み）
npm run lint     # TypeScript 型チェックのみ（tsc --noEmit）
npm test         # Vitest テスト実行
```

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | React 19 + TypeScript |
| ビルド | Vite 6 |
| スタイル | Tailwind CSS v4（`@import "tailwindcss"` 形式） |
| アニメーション | motion/react（framer-motion v11） |
| バックエンド | Firebase（Firestore + Auth） |
| ホスティング | Vercel（`main` ブランチ自動デプロイ） |
| アイコン | lucide-react |

---

## ディレクトリ構成

```
src/
├── App.tsx                  # メインコンポーネント（2700行超 ← 分割候補）
├── types.ts                 # 型定義（Event, PreparationItem, etc.）
├── constants.ts             # REGION_STYLE, TYPE_STYLE, REGIONS, DAYS_JP 等
├── components/
│   ├── HomeView.tsx         # ホーム（直近イベント一覧）
│   ├── KanbanView.tsx       # カンバンビュー（ステータス管理）
│   ├── MasterItemsView.tsx  # 備品マスター管理（Firestore: masterItems）
│   ├── PreparationList.tsx  # 準備物リスト（印刷・商談提案PDF・LINE共有）
│   ├── LoginScreen.tsx      # ログイン画面（背景: /public/mercury-office.jpg）
│   ├── EXLogo.tsx           # EXロゴコンポーネント
│   ├── Dashboard.tsx        # ※削除済み（不使用）
│   └── photos/
│       ├── PhotoUpload.tsx
│       └── PhotoGallery.tsx
├── lib/
│   ├── firebase.ts          # Firebase初期化・Auth関数
│   ├── permissions.ts       # 編集権限チェック関数
│   ├── allowedUsers.ts      # Firestore allowedUsers コレクション認証
│   └── photoStorage.ts      # Cloudinary写真アップロード
├── hooks/
│   ├── usePhotos.ts
│   └── useRoles.ts
└── data/
    └── eventTypes.ts        # イベント種別マスター
```

---

## Firestore コレクション

| コレクション | 用途 |
|---|---|
| `events` | イベント本体 |
| `events/{id}/preparationItems` | 準備物リスト |
| `allowedUsers` | ログイン許可ユーザー（メール or UID でドキュメントID） |
| `staff` | スタッフリスト |
| `masterItems` | 備品マスター（MasterItemsView で管理） |
| `userProfiles` | ユーザープロフィール |

---

## 権限モデル

- **ログイン許可**: `allowedUsers` コレクションにメールアドレスが存在するユーザーのみ
- **イベント編集**: `permissions.ts` の `EVENT_EDITOR_EMAILS` に含まれるアドレスのみ、かつデスクトップのみ
- **準備物リスト編集**: ログイン済みユーザー全員
- **写真アップロード**: ログイン済みユーザー全員

`EVENT_EDITOR_EMAILS` と Firestore セキュリティルールは常に揃えること。

---

## ビュー構成

`ViewMode` = `"home" | "calendar" | "kanban" | "prep" | "archive" | "master"`

| ビュー | 説明 |
|---|---|
| `home` | 直近イベント・開催中・期限超過の一覧（デフォルト起動） |
| `calendar` | 月グリッドカレンダー（デスクトップ）/ タイムライン一覧（モバイル） |
| `kanban` | 予定→準備中→入荷待ち→準備完了→完了の5列カンバン |
| `prep` | 準備物リスト（イベント選択 → 詳細編集） |
| `archive` | 終了イベントのアーカイブ |
| `master` | 備品マスターCRUD |

---

## イベントのステータス

```ts
type EventStatus = 'scheduled' | 'in_progress' | 'waiting' | 'ready' | 'completed' | 'cancelled';
```

---

## CSS / スタイリング注意点

- Tailwind CSS v4 は CSS 変数に直接アクセスできる：`bg-[var(--surface)]`
- ダークモード：`document.documentElement.classList.toggle('dark', isDark)`
- **Recharts の SVG fill は Tailwind v4 に上書きされる** → カスタム Tick コンポーネントで `style={{ fill: '...' }}` を使うこと（`fill="..."` 属性では効かない）

---

## 印刷機能

- 通常印刷: `#prep-print-area` を対象にした `@media print` CSS
- 商談提案PDF: `body.printing-proposal` クラスを付与してから `window.print()`
  - モーダルは `createPortal(content, document.body)` で `#root` の外にレンダリング
  - `id="proposal-modal-root"` / `id="proposal-print-area"` / `id="proposal-content"` が使われる

---

## 環境変数（Vercel に設定済み、リポジトリにコミット不可）

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
CLOUDINARY_API_KEY        # サーバーサイドのみ
CLOUDINARY_API_SECRET     # サーバーサイドのみ
FIREBASE_SERVICE_ACCOUNT_JSON  # サーバーサイドのみ
```

---

## Git ブランチ運用

- `main` → Vercel 自動デプロイ
- 開発ブランチ: `claude/add-company-page-8uJvE`
- **作業完了後は開発ブランチへのプッシュのみ行うこと。`main` へのプッシュは禁止。**
- **PR の作成はユーザーから明示的に指示があった場合のみ実施する。**

---

## UI・テキストのルール

- アプリ内テキスト・ボタンラベル・メッセージには絵文字を使用しない（lucide-react アイコンを使うこと）
- 明示的な指示がある場合のみ例外とする

---

## App.tsx の分割候補（2700行超のため要対応）

将来分離すべきコンポーネント:
- `CalendarView`（月グリッド、約300行）
- `MobileTimelineView` / `MobileWeekStrip` / `MobileDayAgendaView`（約300行）
- イベント詳細モーダル（約400行）
- アーカイブ一覧（約200行）
