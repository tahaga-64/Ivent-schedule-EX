# Figma → Code 統合ルール（Ivent-schedule-EX）

Figma MCP でデザインをこのコードベースに取り込む際に従うルール。生成コードは既存のパターンに必ず合わせること。

---

## 1. Token Definitions（デザイントークン）

トークンは **2 か所** に定義されている。Figma 変数をマッピングする際はこの両方を参照する。

### a) CSS テーマ変数 — `src/index.css` の `@theme` / `@layer base :root`
Tailwind CSS v4 のネイティブ `@theme` ブロックで定義。トランスフォーム（Style Dictionary 等）は **不使用**。

```css
/* src/index.css */
@theme {
  --font-sans: "Inter", "Noto Sans JP", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --color-success: #10b981;  --color-success-bg: #ecfdf5;
  --color-warning: #f59e0b;  --color-warning-bg: #fffbeb;
  --color-danger:  #ef4444;  --color-danger-bg:  #fef2f2;
  --color-info:    #3b82f6;  --color-info-bg:    #eff6ff;
}
@layer base { :root {
  --bg-app: #F8F9FC;  --surface: #FFFFFF;  --primary: #4F46E5;
  --accent: #06B6D4;  --text-primary: #0F172A;  --text-secondary: #64748B;
  --border: #E2E8F0;  --glass: rgba(255,255,255,0.75);
}}
```

- **使い方**: Tailwind v4 では CSS 変数を直接ブラケットで参照 → `bg-[var(--surface)]`、`text-[var(--text-primary)]`。
- 意味的な色（success/warning/danger/info）は CSS 変数を優先。

### b) ドメイントークン — `src/constants.ts`
地域・イベント種別ごとの配色パレット（Firestore データ駆動 UI 用）。**ハードコードせず必ずこのマップ経由で参照**。

```ts
// 地域カラー（7地域）: bg / text / dot / calBg / calBorder
REGION_STYLE["関東"] = { bg:"#e0e7ff", text:"#3730a3", dot:"#6366f1", calBg:"#eef2ff", calBorder:"#a5b4fc" };
// イベント種別カラー: bg / border / text / icon(絵文字)
TYPE_STYLE["水族館"] = { bg:"#ecfeff", border:"#67e8f9", text:"#0e7490", icon:"🐟" };
```

アクセス用ヘルパー（`src/lib/eventHelpers.ts`）: `rs(region)` → REGION_STYLE、`ts(type)` → TYPE_STYLE。
新規コンポーネントで地域/種別の色を使うときは `rs(ev.region).dot` のように **必ずヘルパー経由**。

---

## 2. Component Library（コンポーネント）

- **集中管理されたデザインシステムや Storybook は無い**。コンポーネントは `src/components/*.tsx` に機能単位（ビュー単位）で配置。
- アーキテクチャ: 関数コンポーネント + Hooks。props は各ファイル先頭の `interface Props` / `interface XxxProps` で定義。
- 再利用される小型 UI: `EXBadge.tsx`（3D回転バッジ・`size`/`duration` props）、`EXLogo.tsx`、`LoadingBar.tsx`、`SavingIndicator.tsx`。
- パターン: 1 ビュー = 1 ファイル（例 `HomeView` / `CalendarView` / `KanbanView` / `AlbumView`）。一覧↔詳細はファイル内の `selectedId` state で切替（外部ルーター無し）。

```tsx
interface Props { events: Event[]; }
export default function AlbumView({ events }: Props) { /* ... */ }
```

---

## 3. Frameworks & Libraries

| 項目 | 採用 |
|---|---|
| UI | **React 19** + TypeScript（`~5.8`） |
| ビルド | **Vite 6**（`@vitejs/plugin-react`） |
| スタイル | **Tailwind CSS v4**（`@tailwindcss/vite` プラグイン、`@import "tailwindcss"`） |
| アニメーション | **motion**（`motion/react`、旧 framer-motion v12） |
| アイコン | **lucide-react** |
| グラフ | **recharts** |
| バックエンド | Firebase（Firestore + Auth） |

- PostCSS 設定ファイルは無し（Tailwind は Vite プラグインで処理）。
- パスエイリアス: `@` → リポジトリルート（`vite.config.ts`）。

---

## 4. Asset Management

- **静的アセット**: `public/` 配下を絶対パスで参照（例: ログイン背景 `/mercury-office.jpg`）。
- **ユーザー画像（写真）**: **Cloudinary** にアップロード（`src/lib/photoStorage.ts`）。Firebase Storage は不使用。
  - cloud name `dqwvmz3hk`、unsigned upload preset `'events photo'`、フォルダ `events/{eventId}`。
  - サムネイルは Cloudinary 変換 URL（`thumbnailUrl`）を別途保持。一覧では `thumbnailUrl || url`、拡大時は `url`。
  - 上限: 1イベント **5枚**、1ファイル **10MB**（`MAX_PHOTOS` / `MAX_SIZE_BYTES`）。
- CDN 独自設定は無し（Cloudinary のデフォルト配信）。

---

## 5. Icon System

- すべて **lucide-react** から named import。SVG ファイルやスプライトは持たない。

```tsx
import { ChevronLeft, X, Images, Trash2 } from 'lucide-react';
<Trash2 size={11} className="text-white" />
```

- 慣例: `size`（px 数値）と `className` で色指定。`strokeWidth` を上げる箇所もある（例 `<Plus strokeWidth={3} />`）。
- **イベント種別アイコンは絵文字**（`TYPE_STYLE[type].icon`、`ev.emoji` 優先）。lucide とは別系統なので混同しない。

---

## 6. Styling Approach

- **手法**: Tailwind ユーティリティクラスを JSX に直書き。CSS Modules / styled-components / CSS-in-JS は **不使用**。
- グローバル CSS は `src/index.css` のみ（`@theme` / `@layer base` / `@layer components` / `@media print` / 横画面対応）。
- 共有クラス: `.glass-card`、`.modern-pill`（`@layer components`）。
- **ダークガラス UI が基調**: `bg-white/10 backdrop-blur-sm border border-white/15`。テキストは `text-white` + 不透明度（`text-white/50` 等）。
- レスポンシブ: Tailwind ブレークポイント（`sm:` `md:` `lg:` `xl:`）。モバイル/デスクトップで別コンポーネントを出し分ける箇所あり（カレンダー等）。
- セクション見出しの定番パターン（ページタイトルはこれに統一）:

```tsx
<div>
  <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">PHOTOS</div>
  <h2 className="text-2xl font-black text-white">アルバム</h2>
</div>
```

### ⚠️ Tailwind v4 の注意点
- CSS 変数はブラケットで直接参照可: `bg-[var(--surface)]`。
- **Recharts の SVG `fill` は Tailwind v4 に上書きされる** → カスタム Tick で `style={{ fill: '...' }}` を使う（`fill="..."` 属性は効かない）。
- ダークモード切替: `document.documentElement.classList.toggle('dark', isDark)`。

---

## 7. Project Structure

```
src/
├── App.tsx              # ルート・状態管理・ビュー切替の中枢（大型）
├── main.tsx            # エントリポイント
├── types.ts / types/   # 型定義（Event, EventPhoto, PreparationItem...）
├── constants.ts        # ドメイントークン（REGION_STYLE, TYPE_STYLE, REGIONS...）
├── index.css           # 唯一のグローバル CSS / テーマトークン
├── components/         # ビュー＆UI（1ビュー=1ファイル）
│   └── photos/         # 写真サブ機能（PhotoUpload, PhotoGallery）
├── lib/                # 非UIロジック（firebase, permissions, eventHelpers, photoStorage, exSchedule）
├── hooks/              # usePhotos, useRoles, useDebounce
├── contexts/           # UnsavedChangesContext
└── data/               # eventTypes マスター
```

- **ビュー切替**: `App.tsx` の `ViewMode` union（`"home" | "calendar" | "kanban" | "prep" | "archive" | "master" | "fish" | "layout" | "album"`）。新ビュー追加時は `App.tsx`・`AppHeader.tsx`（desktop nav）・`MobileBottomNav.tsx` の3か所を更新。
- **データフロー**: Firestore `onSnapshot` → `App.tsx` state → props で各ビューへ。書込みは hook 経由（例 `usePhotos`）。
- **権限**: `lib/permissions.ts` の `EVENT_EDITOR_EMAILS`。編集系 UI は `canEdit` props でガード。

---

## Figma 取り込み時のチェックリスト

1. 色は **意味的トークン（CSS変数）** か **ドメイントークン（`rs()`/`ts()`）** にマップ。生の hex 直書きは避ける。
2. スタイルは Tailwind ユーティリティで表現。新規 CSS ファイルは作らない。
3. アイコンは lucide-react に置換（無ければ近いものを選ぶ）。装飾的なものは絵文字も可。
4. ダークガラス基調（`bg-white/10 backdrop-blur border-white/15`）に合わせる。
5. アニメーションは `motion/react` の `motion.div` / `AnimatePresence`。
6. ページ見出しは `text-2xl font-black text-white` ＋ 上に `text-[10px] uppercase tracking-widest` のラベル。
7. 新ビューなら `App.tsx` / `AppHeader.tsx` / `MobileBottomNav.tsx` の登録を忘れない。
8. `npm run build`（型チェック込み）が通ることを確認。
