import { useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Calendar, Menu, ClipboardList, Archive, Home, Package, Fish, LayoutGrid, Images, Plus, Search, LogOut, HelpCircle, CalendarDays } from 'lucide-react';
import PushNotificationButton from './PushNotificationButton';

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout" | "album" | "schedule";

/** 機能名検索の対象。label と keywords（類義語）で曖昧マッチする。 */
const FEATURES: { id: ViewMode; label: string; keywords: string[] }[] = [
  { id: "home",     label: "ホーム",         keywords: ["ホーム", "home", "トップ", "直近", "ダッシュボード"] },
  { id: "calendar", label: "カレンダー",     keywords: ["カレンダー", "calendar", "日程", "月", "予定表"] },
  { id: "prep",     label: "準備物リスト",   keywords: ["準備", "準備物", "prep", "持ち物", "チェックリスト"] },
  { id: "schedule", label: "スケジュール",   keywords: ["スケジュール", "シフト", "schedule", "勤務", "予定"] },
  { id: "fish",     label: "魚リスト",       keywords: ["魚", "さかな", "fish", "水族館", "生体"] },
  { id: "master",   label: "備品マスター",   keywords: ["備品", "マスター", "master", "在庫", "機材"] },
  { id: "layout",   label: "レイアウト",     keywords: ["レイアウト", "layout", "配置", "会場図", "図面"] },
  { id: "album",    label: "アルバム",       keywords: ["アルバム", "写真", "album", "photo", "画像"] },
  { id: "archive",  label: "アーカイブ",     keywords: ["アーカイブ", "archive", "過去", "終了"] },
];

function featureIcon(id: ViewMode) {
  switch (id) {
    case "home":     return <Home size={14} />;
    case "calendar": return <Calendar size={14} />;
    case "prep":     return <ClipboardList size={14} />;
    case "schedule": return <CalendarDays size={14} />;
    case "fish":     return <Fish size={14} />;
    case "master":   return <Package size={14} />;
    case "layout":   return <LayoutGrid size={14} />;
    case "album":    return <Images size={14} />;
    case "archive":  return <Archive size={14} />;
    default:         return <Search size={14} />;
  }
}

/** 入力に一致/類似する機能を返す（最大5件）。 */
function matchFeatures(query: string): { id: ViewMode; label: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FEATURES.filter(f =>
    f.label.toLowerCase().includes(q) ||
    f.keywords.some(k => {
      const kl = k.toLowerCase();
      return kl.includes(q) || q.includes(kl);
    })
  ).slice(0, 5).map(({ id, label }) => ({ id, label }));
}

interface AppHeaderProps {
  user: User;
  view: ViewMode;
  calYear: number;
  calMonth: number;
  searchQuery: string;
  narrowViewport: boolean;
  onToggleSidebar: () => void;
  onSetView: (v: ViewMode) => void;
  onSearchChange: (q: string) => void;
  onCreateEvent: () => void;
  onShowHelp: () => void;
}

export default function AppHeader({
  user,
  view,
  calYear,
  calMonth,
  searchQuery,
  narrowViewport,
  onToggleSidebar,
  onSetView,
  onSearchChange,
  onCreateEvent,
  onShowHelp,
}: AppHeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const featureMatches = matchFeatures(searchQuery);

  const viewLabel =
    view === 'home' ? 'ホーム' :
    view === 'calendar' ? 'カレンダー' :
    view === 'prep' ? '準備物リスト' :
    view === 'archive' ? 'アーカイブ' :
    view === 'master' ? '備品マスター' :
    view === 'fish' ? '魚リスト' :
    view === 'layout' ? 'レイアウト' :
    view === 'album' ? 'アルバム' :
    view === 'schedule' ? 'スケジュール' : '';

  const desktopNavItems: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: "home",     icon: <Home size={14} />,           label: "ホーム" },
    { id: "calendar", icon: <Calendar size={14} />,       label: "カレンダー" },
    { id: "prep",     icon: <ClipboardList size={14} />,  label: "準備物" },
    { id: "archive",  icon: <Archive size={14} />,        label: "アーカイブ" },
    { id: "master",   icon: <Package size={14} />,        label: "備品" },
    { id: "schedule", icon: <CalendarDays size={14} />,    label: "スケジュール" },
    { id: "fish",     icon: <Fish size={14} />,           label: "魚リスト" },
    { id: "layout",   icon: <LayoutGrid size={14} />,     label: "レイアウト" },
    { id: "album",    icon: <Images size={14} />,         label: "アルバム" },
  ];

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/15 backdrop-blur-md"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: 'linear-gradient(to bottom, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.65) 100%)',
      }}
    >
      <div className="h-14 flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4">
        {/* 左: ハンバーガー + ロゴ */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex p-2 -ml-1 rounded-xl text-white/80 hover:bg-white/15 active:bg-white/20 transition-colors"
            aria-label="フィルターを開く"
          >
            <Menu size={20} />
          </button>
          <div className="md:hidden flex flex-col min-w-0">
            <div className="font-black text-sm text-white leading-tight truncate">{viewLabel}</div>
            {view === 'calendar' && (
              <div className="text-[10px] font-bold text-white/45 tabular-nums">{calYear}年{calMonth}月</div>
            )}
          </div>
        </div>

        {/* 中央: 検索バー（イベント絞り込み + 機能名検索） */}
        <div className="flex-1 min-w-0 relative">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-2.5 sm:px-3 py-2">
            <Search size={14} className="text-white/60 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="イベント・機能を検索..."
              className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none min-w-0"
            />
            <kbd className="hidden sm:block text-[10px] text-white/40 font-medium bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
          </div>
          {searchFocused && featureMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-white/15 bg-slate-900/98 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-white/40">機能へ移動</div>
              {featureMatches.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSetView(f.id); onSearchChange(''); setSearchFocused(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-white/80 hover:bg-white/10 transition-colors"
                >
                  <span className="shrink-0 text-indigo-300">{featureIcon(f.id)}</span>
                  <span className="text-xs font-bold">{f.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右: ビュー切替 + 新規 + アバター */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="hidden md:flex bg-white/10 p-1 rounded-xl">
            {desktopNavItems.map(v => (
              <button
                key={v.id}
                onClick={() => onSetView(v.id)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${view === v.id ? 'bg-white/25 text-white shadow-sm border border-white/20' : 'text-white/50 hover:text-white/80'}
                `}
              >
                {v.icon}
                <span className="hidden md:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {!narrowViewport && (
            <button
              onClick={onCreateEvent}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-indigo-200 shadow-md"
            >
              <Plus size={14} strokeWidth={3} />
              <span className="hidden sm:inline">新規イベント</span>
            </button>
          )}

          <div className="flex items-center gap-0.5 sm:gap-1.5">
            <PushNotificationButton user={user} />
            <button
              onClick={onShowHelp}
              className="hidden sm:flex p-1.5 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              title="使い方"
            >
              <HelpCircle size={16} />
            </button>
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-white/50 hidden sm:block" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-200 hidden sm:flex items-center justify-center text-amber-700 font-bold text-xs ring-2 ring-white/50">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <button
              onClick={() => auth.signOut()}
              className="p-2 rounded-xl text-white/70 hover:bg-white/15 hover:text-red-300 active:bg-white/20 transition-colors"
              title="ログアウト"
              aria-label="ログアウト"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
