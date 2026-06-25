import { User } from 'firebase/auth';
import { Calendar, Menu, ClipboardList, Archive, Home, Package, Fish, LayoutGrid, Images, Plus, HelpCircle, CalendarDays, Boxes, UserRound } from 'lucide-react';
import PushNotificationButton from './PushNotificationButton';
import AppSearch from './AppSearch';
import { Event } from '../types';
import type { AppViewMode } from '../lib/appSearch';

type ViewMode = AppViewMode;

interface AppHeaderProps {
  user: User;
  view: ViewMode;
  calYear: number;
  calMonth: number;
  searchQuery: string;
  events: Event[];
  narrowViewport: boolean;
  onToggleSidebar: () => void;
  onSetView: (v: ViewMode) => void;
  onSearchChange: (q: string) => void;
  onSelectEvent: (ev: Event) => void;
  onCreateEvent: () => void;
  onShowHelp: () => void;
  userName?: string;
  onChangeName?: () => void;
}

// ナビを論理グループに分割（グループ間に区切り線を表示して視認性を上げる）
const desktopNavGroups: { id: ViewMode; icon: React.ReactNode; label: string }[][] = [
  [
    { id: 'home', icon: <Home size={20} />, label: 'ホーム' },
    { id: 'calendar', icon: <Calendar size={20} />, label: 'カレンダー' },
    { id: 'schedule', icon: <CalendarDays size={20} />, label: 'スケジュール' },
  ],
  [
    { id: 'prep', icon: <ClipboardList size={20} />, label: '準備物' },
    { id: 'master', icon: <Package size={20} />, label: '備品' },
    { id: 'archive', icon: <Archive size={20} />, label: 'アーカイブ' },
  ],
  [
    { id: 'fish', icon: <Fish size={20} />, label: '魚リスト' },
    { id: 'layout', icon: <LayoutGrid size={20} />, label: 'レイアウト' },
    { id: 'album', icon: <Images size={20} />, label: 'アルバム' },
    { id: 'container', icon: <Boxes size={20} />, label: 'コンテナ' },
  ],
];

export default function AppHeader({
  user,
  view,
  calYear,
  calMonth,
  searchQuery,
  events,
  narrowViewport,
  onToggleSidebar,
  onSetView,
  onSearchChange,
  onSelectEvent,
  onCreateEvent,
  onShowHelp,
  userName = '',
  onChangeName,
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
    view === 'schedule' ? 'スケジュール' :
    view === 'container' ? 'コンテナボックス' : '';

  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-3 sm:px-4 pt-2 pb-2.5 space-y-2">
        {/* 行1: ナビ・タイトル・アクション（検索バーと分離して重なり防止） */}
        <div className="flex items-center gap-2 sm:gap-3 min-h-10">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <button
              onClick={onToggleSidebar}
              className="hidden md:flex p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              aria-label="フィルターを開く"
            >
              <Menu size={20} />
            </button>
            <div className="md:hidden flex flex-col min-w-0 max-w-[40vw]">
              <div className="font-black text-sm text-slate-900 leading-tight truncate">{viewLabel}</div>
              {view === 'calendar' && (
                <div className="text-[10px] font-bold text-slate-500 tabular-nums">{calYear}年{calMonth}月</div>
              )}
            </div>
          </div>

          <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 min-w-0 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {desktopNavGroups.map((group, gi) => (
              <div key={gi} className="flex items-center gap-1">
                {gi > 0 && <div className="h-9 w-px bg-slate-200 mx-1 shrink-0" aria-hidden />}
                {group.map(v => (
                  <button
                    key={v.id}
                    onClick={() => onSetView(v.id)}
                    title={v.label}
                    className={`
                      flex flex-col items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition-all shrink-0 whitespace-nowrap
                      ${view === v.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                    `}
                  >
                    {v.icon}
                    <span className="text-[11px] leading-none">{v.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 ml-auto">
            {/* 名前（ログインの代わり・タップで変更） */}
            <button
              type="button"
              onClick={onChangeName}
              title="名前を変更"
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors max-w-[110px] sm:max-w-[140px]"
            >
              <UserRound size={14} className="shrink-0" />
              <span className="truncate">{userName || '名前未設定'}</span>
            </button>
            {/* 新規イベント作成（全員可） */}
            <button
              type="button"
              onClick={onCreateEvent}
              className="flex items-center gap-1 sm:gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-md shadow-indigo-200 whitespace-nowrap"
              aria-label="新規イベント作成"
            >
              <Plus size={15} strokeWidth={3} />
              新規
            </button>
            <PushNotificationButton user={user} />
            <button
              onClick={onShowHelp}
              className="hidden sm:flex p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="使い方"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </div>

        {/* 行2: 検索バー（全幅・独立行） */}
        <AppSearch
          searchQuery={searchQuery}
          events={events}
          onSearchChange={onSearchChange}
          onSetView={onSetView}
          onSelectEvent={onSelectEvent}
        />
      </div>
    </header>
  );
}
