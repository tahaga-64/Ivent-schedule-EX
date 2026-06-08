import { Calendar, ClipboardList, Home, Package, Fish, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout";

interface MobileBottomNavProps {
  view: ViewMode;
  onSetView: (v: ViewMode) => void;
}

const NAV_ITEMS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: "home",     icon: <Home size={20} />,           label: "ホーム" },
  { id: "calendar", icon: <Calendar size={20} />,       label: "カレンダー" },
  { id: "prep",     icon: <ClipboardList size={20} />,  label: "準備物" },
  { id: "master",   icon: <Package size={20} />,        label: "備品" },
  { id: "fish",     icon: <Fish size={20} />,           label: "魚リスト" },
  { id: "layout",   icon: <LayoutGrid size={20} />,     label: "レイアウト" },
];

export default function MobileBottomNav({ view, onSetView }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t border-white/15 flex items-center justify-around pb-[env(safe-area-inset-bottom)] z-20 md:hidden"
      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.92) 100%)" }}
    >
      {NAV_ITEMS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSetView(tab.id)}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-3 text-[10px] font-bold transition-colors ${
            view === tab.id ? "text-white" : "text-white/50"
          }`}
        >
          {tab.icon}
          {tab.label}
          {view === tab.id && (
            <motion.div
              layoutId="nav-indicator"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-white"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
          )}
        </button>
      ))}
    </nav>
  );
}
