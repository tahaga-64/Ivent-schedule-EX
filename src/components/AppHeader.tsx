import { User } from 'firebase/auth';
import { Calendar, Menu, ClipboardList, Archive, Home, Package, Fish, LayoutGrid, Images, Plus, HelpCircle, CalendarDays, Boxes, Sparkles } from 'lucide-react';
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
}

const desktopNavItems: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'home', icon: <Home size={14} />, label: 'ホーム' },
  { id: 'calendar', icon: <Calendar size={14} />, label: 'カレンダー' },
  { id: 'prep', icon: <ClipboardList size={14} />, label: '準備物' },
  { id: 'archive', icon: <Archive size={14} />, label: 'アーカイブ' },
  { id: 'master', icon: <Package size={14} />, label: '備品' },
  { id: 'schedule', icon: <CalendarDays size={14} />, label: 'スケジュール' },
  { id: 'fish', icon: <Fish size={14} />, label: '魚リスト' },
  { id: 'layout', icon: <LayoutGrid size={14} />, label: 'レイアウト' },
  { id: 'album', icon: <Images size={14} />, label: 'アルバム' },
  { id: 'container', icon: <Boxes size={14} />, label: 'コンテナボックス' },
  { id: 'experience', icon: <Sparkles size={14} />, label: '体験' },
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
    view === 'container' ? 'コンテナボックス' :
    view === 'experience' ? '体験' : '';

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

          <div className="hidden lg:flex flex-1 items-center justify-center gap-0.5 min-w-0 overflow-x-auto scrollbar-hide px-1">
            {desktopNavItems.map(v => (
              <button
                key={v.id}
                onClick={() => onSetView(v.id)}
                title={v.label}
                className={`
                  flex items-center gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap
                  ${view === v.id ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                `}
              >
                {v.icon}
                <span className="hidden xl:inline">{v.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 ml-auto">
            {!narrowViewport && (
              <button
                onClick={onCreateEvent}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all shadow-indigo-200 shadow-md"
              >
                <Plus size={14} strokeWidth={3} />
                <span className="hidden sm:inline">新規</span>
              </button>
            )}
            <PushNotificationButton user={user} />
            <button
              onClick={onShowHelp}
              className="hidden sm:flex p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="使い方"
            >
              <HelpCircle size={16} />
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
