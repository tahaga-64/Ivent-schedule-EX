# デザイン改善ブリーフ — 2026-05-22

target: Ivent Manager（EX事業部向けイベント管理Webアプリ）
stack: React 19 / Tailwind CSS v4 / motion/react
ref: `.company/research/reports/2026-05-22-modern-saas-comparison.md`

---

## このブリーフの使い方

各改善項目には「対象ファイル」「現状クラス → 変更後クラス」「Tailwindスニペット」を記載しています。
エンジニアはこのブリーフを元に実装を進めてください。
デザインレビューは各タスク完了後に `.company/design/briefs/` 以下にスクリーンショットを添付すること。

---

## 1. セマンティックカラートークンの追加

**対象ファイル**: `src/index.css`

**背景**: 現状のカラーCSS変数は `--primary`（インディゴ）と `--accent`（シアン）のみ。
成功・警告・危険・情報のセマンティックカラーが未定義で、各コンポーネントに色が直書きされている。

**実装（`@theme` ブロックへの追記）**:

```css
@theme {
  /* --- 既存 --- */
  --color-purple-accent: #4f46e5;

  /* --- 追加: セマンティックカラー（ライトモード用） --- */
  --color-success:     #10b981; /* emerald-500 */
  --color-success-bg:  #ecfdf5; /* emerald-50  */
  --color-success-muted: #6ee7b7; /* emerald-300 */

  --color-warning:     #f59e0b; /* amber-500   */
  --color-warning-bg:  #fffbeb; /* amber-50    */

  --color-danger:      #ef4444; /* red-500     */
  --color-danger-bg:   #fef2f2; /* red-50      */

  --color-info:        #3b82f6; /* blue-500    */
  --color-info-bg:     #eff6ff; /* blue-50     */
}

@layer base {
  .dark {
    /* --- 追加: セマンティックカラー（ダークモード用） --- */
    --color-success:     #34d399; /* emerald-400 */
    --color-success-bg:  rgba(16, 185, 129, 0.12);
    --color-warning:     #fbbf24; /* amber-400   */
    --color-warning-bg:  rgba(245, 158, 11, 0.12);
    --color-danger:      #f87171; /* red-400     */
    --color-danger-bg:   rgba(239, 68, 68, 0.12);
    --color-info:        #60a5fa; /* blue-400    */
    --color-info-bg:     rgba(59, 130, 246, 0.12);
  }
}
```

**使用例**:
```tsx
// 準備完了バッジ
<span className="bg-[var(--color-success-bg)] text-[var(--color-success)] px-2 py-0.5 rounded-full text-[10px] font-black">完了</span>

// 未着バッジ
<span className="bg-[var(--color-danger-bg)] text-[var(--color-danger)] px-2 py-0.5 rounded-full text-[10px] font-black">未着</span>
```

---

## 2. タイポグラフィ Modular Scale の整備

**対象ファイル**: `src/index.css`

**背景**: `text-xs`（12px）と `text-sm`（14px）の2階層に集中しすぎている。
見出しと本文の視覚的差が小さく、情報ヒエラルキーが弱い。

**実装（`@theme` ブロックへの追記）**:

```css
@theme {
  /* Modular Scale（1.25比率） */
  --text-display: 2rem;      /* 32px: 日付表示（TODAYの数字）→ 現状のまま維持 */
  --text-title:   1.25rem;   /* 20px: モーダルタイトル・ページ見出し */
  --text-heading: 1rem;      /* 16px: セクション見出し */
  --text-body:    0.875rem;  /* 14px: 標準本文（現 text-sm） */
  --text-caption: 0.75rem;   /* 12px: ラベル・メタ情報（現 text-xs） */
  --text-micro:   0.625rem;  /* 10px: バッジ・タグ・トラッキング広いラベル */
}
```

**置き換えルール**（App.tsx・各コンポーネント）:

| 現状 | 変更後 | 用途 |
|------|--------|------|
| `text-xs font-black tracking-widest uppercase` | `text-[var(--text-micro)] font-black tracking-widest uppercase` | セクションラベル（REGION, TYPE等） |
| `text-xs font-bold` | `text-[var(--text-caption)] font-medium` | サイドバー項目・メタ情報 |
| `text-sm font-bold` | `text-[var(--text-body)] font-semibold` | フォームラベル・リスト本文 |
| `text-base font-black` | `text-[var(--text-heading)] font-bold` | モーダルタイトル・テーブル見出し |
| `text-4xl font-black` | `text-[var(--text-display)] font-black` | TODAYの日付数字（現状維持） |

---

## 3. モバイルボトムナビゲーションバー

**対象ファイル**: `src/App.tsx`（ヘッダー直後に追加）

**背景**: モバイルでのビュー切替がカレンダー上部の4タブに集中しており、親指が届きにくい。

**実装スニペット**:

```tsx
{/* Mobile Bottom Navigation — lg以上では非表示 */}
<nav className="
  fixed bottom-0 inset-x-0 z-40 lg:hidden
  h-16 bg-white/95 dark:bg-zinc-900/95
  backdrop-blur-md
  border-t border-slate-100 dark:border-white/8
  flex items-center
  safe-area-inset-bottom
">
  {[
    { id: "calendar", icon: <Calendar size={20} />, label: "カレンダー" },
    { id: "prep",     icon: <ClipboardList size={20} />, label: "準備物" },
    { id: "archive",  icon: <Archive size={20} />, label: "アーカイブ" },
  ].map(tab => (
    <button
      key={tab.id}
      onClick={() => setView(tab.id as any)}
      className={`
        flex-1 flex flex-col items-center justify-center gap-1
        min-h-[44px] py-2 transition-colors
        ${view === tab.id
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-slate-400 dark:text-slate-500"}
      `}
    >
      {tab.icon}
      <span className="text-[10px] font-bold">{tab.label}</span>
    </button>
  ))}
  {canEditEvent && (
    <button
      onClick={() => handleCreateEvent()}
      className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 text-indigo-600"
    >
      <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
        <Plus size={18} className="text-white" strokeWidth={3} />
      </div>
    </button>
  )}
</nav>
```

**Tailwindクラスのポイント**:
- `safe-area-inset-bottom`: iPhoneのホームバー領域を避ける（`pb-[env(safe-area-inset-bottom)]` と組み合わせても良い）
- `backdrop-blur-md bg-white/95`: スクロール時の透過感
- `min-h-[44px]`: Appleのタップターゲット最小サイズを確保
- 既存のヘッダー右側のビュー切替ボタン（`hidden md:flex`）は `lg:flex` に変更して整合を取る

---

## 4. カレンダーイベントチップへの進捗バー追加

**対象ファイル**: `src/components/EventChip.tsx`

**背景**: `prepProgressMap` は実装済みだがカレンダーチップには未反映。

**実装スニペット**（EventChip の最外側コンテナに `relative` を追加し内部に追記）:

```tsx
// EventChipコンポーネントのpropsにprogress追加
interface EventChipProps {
  event: Event;
  progress?: { total: number; done: number }; // 追加
  // ...existing props
}

// チップのJSX内、最下部に追加
{progress && progress.total > 0 && (
  <div
    className="absolute bottom-0 inset-x-0 h-[3px] rounded-b-md overflow-hidden"
    aria-hidden="true"
  >
    <div
      className="h-full bg-emerald-400/80 dark:bg-emerald-500/70 transition-all duration-500"
      style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
    />
  </div>
)}
```

**App.tsx での呼び出し変更**:
```tsx
// CalendarView / EventChip呼び出し箇所
<EventChip
  event={ev}
  progress={prepProgressMap[ev.id]}
  // ...
/>
```

**視覚的な意味**:
- バー非表示: 準備物未登録
- バー0% (灰色のみ): 準備物あり・全未完了
- バー緑で伸びる: 完了した準備物の割合
- バー100%: 全完了 → バー色を `emerald-500` に変更してお祝いフィードバック

---

## 5. モーダル開閉アニメーションのスプリング化

**対象ファイル**: `src/App.tsx`（selected モーダル、dayDetail モーダル）

**背景**: 現状はフェードのみでモーダルの質感が平坦。

**変更前**:
```tsx
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.3 }}
```

**変更後**:
```tsx
// モーダルコンテナ（オーバーレイ）
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.2 }}

// モーダルパネル本体
initial={{ opacity: 0, scale: 0.97, y: 12 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.97, y: 12 }}
transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.8 }}
```

**サイドバートグルのスプリング化**:
```tsx
// Sidebar（AnimatePresenceで囲む）
initial={{ x: -288, opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: -288, opacity: 0 }}
transition={{ type: "spring", stiffness: 350, damping: 32 }}
```

**`prefers-reduced-motion` 対応**:
```tsx
// src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    mq.addEventListener('change', e => setReduced(e.matches));
  }, []);
  return reduced;
}

// 使用時
const reducedMotion = useReducedMotion();
const springTransition = reducedMotion
  ? { duration: 0.01 }
  : { type: "spring", stiffness: 380, damping: 28 };
```

---

## 6. サイドバー KPI カードブロック

**対象ファイル**: `src/App.tsx`（サイドバー内 TODAY セクションの直下）

**背景**: Fathom Analytics の「大きい数字 + 小さいラベル」スタイルを参考に、イベント全体状況をひと目で把握できるブロックを追加。

**実装スニペット**:

```tsx
{/* KPI ミニカード — TODAYセクション下 */}
<div className="grid grid-cols-2 gap-2 pb-4 border-b border-slate-100 dark:border-white/8">
  <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
    <div className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">
      {stats.total}
    </div>
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
      総イベント
    </div>
  </div>

  <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none">
      {overallPrepPct}%
    </div>
    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">
      準備完了
    </div>
  </div>
</div>
```

**`overallPrepPct` の計算（`useMemo` で追加）**:
```tsx
const overallPrepPct = useMemo(() => {
  const entries = Object.values(prepProgressMap);
  if (entries.length === 0) return 0;
  const total = entries.reduce((s, e) => s + e.total, 0);
  const done  = entries.reduce((s, e) => s + e.done, 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}, [prepProgressMap]);
```

---

## 7. コマンドパレット（⌘K）

**対象ファイル**: 新規 `src/components/CommandPalette.tsx`、`src/App.tsx` から呼び出し

**背景**: Linear・Raycastの主要UX。PC利用の編集者3名の操作効率を最大化する。

**コンポーネント構造**:
```tsx
// src/components/CommandPalette.tsx
interface Command {
  id: string;
  label: string;
  category: "navigation" | "event" | "filter";
  icon: ReactNode;
  action: () => void;
  shortcut?: string;
}

// Tailwind クラス構成
// オーバーレイ
"fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[200] flex items-start justify-center pt-[15vh]"

// パレット本体
"w-full max-w-xl mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden"

// 検索input
"w-full px-5 py-4 text-base bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"

// 区切り線
"border-t border-slate-100 dark:border-white/8"

// 候補リスト
"max-h-72 overflow-y-auto overscroll-contain py-2"

// 候補アイテム（非選択）
"flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer"

// 候補アイテム（選択中）
"flex items-center gap-3 px-4 py-2.5 text-sm bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 cursor-pointer"

// カテゴリラベル
"px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest"

// ショートカットバッジ
"ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono"
```

**キーバインド登録（App.tsx に追加）**:
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setPaletteOpen(v => !v);
    }
    if (e.key === 'Escape') setPaletteOpen(false);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

---

## 8. 準備物リストのステータスカラー統一

**対象ファイル**: `src/components/PreparationList.tsx`

**背景**: 現状は「arrived」「prepared」フラグが個別アイコンで表示されているが、行の視覚的ステータスが不明確。

**信号機ロジック（行の左ボーダー）**:

```tsx
// 行の左側に3pxの状態ボーダーを追加
const rowBorderColor = item.arrived && item.prepared
  ? "border-l-4 border-l-emerald-400"  // 全完了: 緑
  : item.arrived || item.prepared
  ? "border-l-4 border-l-amber-400"    // 部分完了: 黄
  : "border-l-4 border-l-slate-200 dark:border-l-white/10";  // 未着手: グレー

// テーブル行
<tr className={`${rowBorderColor} transition-colors`}>
```

**ステータスバッジの Tailwind クラス**:
```tsx
const statusBadge = {
  done:    "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-emerald-200",
  partial: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-amber-200",
  none:    "bg-slate-50 text-slate-400 border border-slate-200 dark:bg-white/5 dark:border-white/10",
};
```

---

## 9. イベント詳細モーダルのプロパティ行レイアウト

**対象ファイル**: `src/components/NewEventModal.tsx` または `App.tsx` 内のモーダル部分

**背景**: 縦積みinputフォームをNotion風の横並びプロパティ行に変更し、情報を一覧しやすくする。

**レイアウトパターン**:
```tsx
{/* プロパティ行の共通パターン */}
<div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-white/8 last:border-0">
  {/* ラベル */}
  <div className="w-24 shrink-0 flex items-center gap-1.5 pt-0.5">
    <span className="text-slate-400 dark:text-slate-500">{/* icon */}</span>
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
  </div>
  {/* 値（編集可能） */}
  <div className="flex-1">
    <input
      className="
        w-full text-sm text-slate-800 dark:text-slate-100
        bg-transparent outline-none
        hover:bg-slate-50 dark:hover:bg-white/5
        focus:bg-slate-50 dark:focus:bg-white/5
        rounded-lg px-2 py-1 -mx-2
        transition-colors
        placeholder-slate-300
      "
      placeholder={`${label}を入力...`}
    />
  </div>
</div>
```

---

## 10. モバイル週ビューのスワイプジェスチャー

**対象ファイル**: `src/App.tsx`（MobileMonthWeekGrid の呼び出し箇所）

**実装（motion/react のドラッグ使用）**:
```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.2}
  onDragEnd={(_, info) => {
    if (info.offset.x < -60) {
      // 次の週へ
      setMobileWeekRowIndex(prev => Math.min(prev + 1, maxWeekRow));
    } else if (info.offset.x > 60) {
      // 前の週へ
      setMobileWeekRowIndex(prev => Math.max(prev - 1, 0));
    }
  }}
>
  <MobileMonthWeekGrid ... />
</motion.div>
```

---

## チェックリスト（実装完了確認用）

- [ ] 1. セマンティックカラートークン追加（`src/index.css`）
- [ ] 2. タイポグラフィ Modular Scale 追加（`src/index.css`）
- [ ] 3. モバイルボトムナビゲーションバー実装（`src/App.tsx`）
- [ ] 4. カレンダーチップへの進捗バー追加（`src/components/EventChip.tsx`）
- [ ] 5. モーダル/サイドバーのスプリングアニメーション化（`src/App.tsx`）
- [ ] 6. サイドバー KPI カードブロック追加（`src/App.tsx`）
- [ ] 7. コマンドパレット（⌘K）実装（`src/components/CommandPalette.tsx`）
- [ ] 8. 準備物リスト行の信号機ステータスカラー（`src/components/PreparationList.tsx`）
- [ ] 9. モーダルのプロパティ行レイアウト変更（`src/components/NewEventModal.tsx`）
- [ ] 10. モバイル週ビューのスワイプジェスチャー（`src/App.tsx`）

---

## デザインレビュー依頼先

実装完了後、以下の観点でスクリーンショットレビューを実施:

1. **モバイル（375px幅）**: ボトムナビ・カレンダータブ・イベントチップの視認性
2. **タブレット（768px幅）**: サイドバーあり/なしの切替境界
3. **PC（1280px幅）**: サイドバー KPI + カレンダーグリッドの全体バランス
4. **ダークモード**: 全画面でカラートークンが正しく反映されているか

---

*作成: Research & Design Division / 2026-05-22*
