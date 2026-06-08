import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Calendar, Menu, ClipboardList, Archive, Home, Package, Fish, LayoutGrid, Plus, Search, LogOut, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout";

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
    view === 'layout' ? 'レイアウト' : '';

  const desktopNavItems: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: "home",     icon: <Home size={14} />,           label: "ホーム" },
    { id: "calendar", icon: <Calendar size={14} />,       label: "カレンダー" },
    { id: "prep",     icon: <ClipboardList size={14} />,  label: "準備物" },
    { id: "archive",  icon: <Archive size={14} />,        label: "アーカイブ" },
    { id: "master",   icon: <Package size={14} />,        label: "備品" },
    { id: "fish",     icon: <Fish size={14} />,           label: "魚リスト" },
    { id: "layout",   icon: <LayoutGrid size={14} />,     label: "レイアウト" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-transparent border-b border-white/15" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="h-14 flex items-center justify-between px-4 gap-2 sm:gap-4">
        {/* 左: ハンバーガー + ロゴ */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button onClick={onToggleSidebar} className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 transition-colors">
            <Menu size={18} />
          </button>
          <div style={{ perspective: 140 }} className="shrink-0">
            <motion.div
              className="relative w-9 h-9"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            >
              {/* 前面 */}
              <div
                className="absolute inset-0 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.45) 0%, rgba(79,70,229,0.25) 100%)',
                  border: '1px solid rgba(165,180,252,0.5)',
                  boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 20px rgba(96,165,250,0.4)',
                  transform: 'translateZ(4px)',
                }}
              >
                <span
                  className="font-black text-sm bg-gradient-to-br from-cyan-300 via-indigo-200 to-violet-400 bg-clip-text text-transparent tracking-tighter leading-none"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.9))' }}
                >
                  EX
                </span>
              </div>
              {/* 背面 */}
              <div
                className="absolute inset-0 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(79,70,229,0.4) 0%, rgba(49,46,129,0.3) 100%)',
                  border: '1px solid rgba(129,140,248,0.4)',
                  boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.25), 0 0 20px rgba(96,165,250,0.3)',
                  transform: 'translateZ(-4px) rotateY(180deg)',
                }}
              >
                <span
                  className="font-black text-sm bg-gradient-to-br from-violet-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent tracking-tighter leading-none"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.9))' }}
                >
                  EX
                </span>
              </div>
              {/* 厚み（側面の縁） */}
              <div
                className="absolute rounded-full"
                style={{
                  top: '50%', left: '50%', width: 8, height: 30,
                  transform: 'translate(-50%,-50%) rotateY(90deg)',
                  background: 'linear-gradient(to bottom, rgba(129,140,248,0.6), rgba(49,46,129,0.7))',
                }}
              />
            </motion.div>
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm text-white leading-tight">Event Manager</div>
          </div>
          <div className="sm:hidden flex flex-col">
            <div className="text-[10px] font-black text-white/60 tracking-widest uppercase">{calYear}年{calMonth}月</div>
            <div className="font-black text-sm text-white leading-tight">{viewLabel}</div>
          </div>
        </div>

        {/* 中央: 検索バー */}
        <div className="flex-1 min-w-0 max-w-sm md:max-w-xl xl:max-w-2xl">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
            <Search size={13} className="text-white/60 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="会場・クライアントを検索..."
              className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none min-w-0"
            />
            <kbd className="hidden sm:block text-[10px] text-white/40 font-medium bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
          </div>
        </div>

        {/* 右: ビュー切替 + 新規 + アバター */}
        <div className="flex items-center gap-2 shrink-0">
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={onShowHelp}
              className="p-1.5 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              title="使い方"
            >
              <HelpCircle size={16} />
            </button>
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-white/50" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs ring-2 ring-white/50">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <button
              onClick={() => auth.signOut()}
              className="p-1.5 rounded-lg text-white/70 hover:bg-white/15 hover:text-red-300 transition-colors"
              title="ログアウト"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
