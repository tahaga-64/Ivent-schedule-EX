import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Calendar, Menu, ClipboardList, Archive, Home, Package, Fish, LayoutGrid, Images, Plus, Search, LogOut, HelpCircle, CalendarDays } from 'lucide-react';
import PushNotificationButton from './PushNotificationButton';
import EXBadge from './EXBadge';

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout" | "album" | "schedule";

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
    { id: "schedule", icon: <CalendarDays size={14} />,    label: "シフト" },
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
            className="p-2 -ml-1 rounded-xl text-white/80 hover:bg-white/15 active:bg-white/20 transition-colors"
            aria-label="フィルターを開く"
          >
            <Menu size={20} />
          </button>
          <EXBadge size={28} />
          <div className="sm:hidden flex flex-col min-w-0">
            <div className="font-black text-sm text-white leading-tight truncate">{viewLabel}</div>
            {view === 'calendar' && (
              <div className="text-[10px] font-bold text-white/45 tabular-nums">{calYear}年{calMonth}月</div>
            )}
          </div>
        </div>

        {/* 中央: 検索バー */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-2.5 sm:px-3 py-2">
            <Search size={14} className="text-white/60 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="検索..."
              className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none min-w-0"
            />
            <kbd className="hidden sm:block text-[10px] text-white/40 font-medium bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
          </div>
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
