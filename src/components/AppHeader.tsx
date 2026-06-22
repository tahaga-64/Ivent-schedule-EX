import { User } from 'firebase/auth';
import { Calendar, Menu, ClipboardList, Archive, Home, Package, Fish, LayoutGrid, Images, Plus, HelpCircle, CalendarDays, Boxes } from 'lucide-react';
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
  isMobileAdmin?: boolean;
  onAdminSignIn?: () => void;
  onAdminSignOut?: () => void;
  adminAuthBusy?: boolean;
  adminAuthError?: string | null;
}

// ナビを論理グループに分割（グループ間に区切り線を表示して視認性を上げる）
const desktopNavGroups: { id: ViewMode; icon: React.ReactNode; label: string }[][] = [
  [
    { id: 'home', icon: <Home size={17} />, label: 'ホーム' },
    { id: 'calendar', icon: <Calendar size={17} />, label: 'カレンダー' },
    { id: 'schedule', icon: <CalendarDays size={17} />, label: 'スケジュール' },
  ],
  [
    { id: 'prep', icon: <ClipboardList size={17} />, label: '準備物' },
    { id: 'master', icon: <Package size={17} />, label: '備品' },
    { id: 'archive', icon: <Archive size={17} />, label: 'アーカイブ' },
  ],
  [
    { id: 'fish', icon: <Fish size={17} />, label: '魚リスト' },
    { id: 'layout', icon: <LayoutGrid size={17} />, label: 'レイアウト' },
    { id: 'album', icon: <Images size={17} />, label: 'アルバム' },
    { id: 'container', icon: <Boxes size={17} />, label: 'コンテナ' },
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
  isMobileAdmin = false,
  onAdminSignIn,
  onAdminSignOut,
  adminAuthBusy = false,
  adminAuthError = null,
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

          <nav className="hidden lg:flex flex-1 items-center justify-center gap-1.5 min-w-0 px-1">
            {desktopNavGroups.map((group, gi) => (
              <div key={gi} className="flex items-center gap-1">
                {gi > 0 && <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" aria-hidden />}
                {group.map(v => (
                  <button
                    key={v.id}
                    onClick={() => onSetView(v.id)}
                    title={v.label}
                    className={`
                      flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-sm font-bold transition-all shrink-0 whitespace-nowrap
                      ${view === v.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
                    `}
                  >
                    {v.icon}
                    <span className="hidden xl:inline">{v.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 ml-auto">
            {narrowViewport && view === 'schedule' && (
              <div className="flex flex-col items-end gap-0.5">
                {isMobileAdmin ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-indigo-700 max-w-[88px] truncate">
                      {user.email?.split('@')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={onAdminSignOut}
                      disabled={adminAuthBusy}
                      className="px-2 py-1 rounded-lg text-[10px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      ログアウト
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onAdminSignIn}
                    disabled={adminAuthBusy}
                    className="px-2 py-1 rounded-lg text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {adminAuthBusy ? '認証中…' : '管理者ログイン'}
                  </button>
                )}
                {adminAuthError && (
                  <span className="text-[9px] font-bold text-red-600 max-w-[140px] text-right leading-tight">
                    {adminAuthError}
                  </span>
                )}
              </div>
            )}
            {!narrowViewport && (
              <button
                onClick={onCreateEvent}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all shadow-indigo-200 shadow-md"
              >
                <Plus size={16} strokeWidth={3} />
                <span className="hidden sm:inline">新規</span>
              </button>
            )}
            <PushNotificationButton user={user} />
            <button
              onClick={onShowHelp}
              className="hidden sm:flex p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="使い方"
            >
              <HelpCircle size={18} />
            </button>
            {!user.isAnonymous && (
              user.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-slate-200 hidden sm:block" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-200 hidden sm:flex items-center justify-center text-amber-700 font-bold text-xs ring-2 ring-slate-200">
                  {user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )
            )}
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
