import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ClipboardList, Home, Package, Fish, LayoutGrid, Images, Archive, MoreHorizontal, X, CalendarDays, Boxes, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { burstAt } from '../lib/fx';

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout" | "album" | "schedule" | "container" | "shipping";

interface MobileBottomNavProps {
  view: ViewMode;
  onSetView: (v: ViewMode) => void;
}

const PRIMARY_TABS: { id: ViewMode | 'more'; icon: React.ReactNode; label: string }[] = [
  { id: "home",     icon: <Home size={24} />,           label: "ホーム" },
  { id: "calendar", icon: <Calendar size={24} />,       label: "カレンダー" },
  { id: "prep",     icon: <ClipboardList size={24} />,  label: "準備物" },
  { id: "more",     icon: <MoreHorizontal size={24} />, label: "その他" },
];

const MORE_ITEMS: { id: ViewMode; icon: React.ReactNode; label: string; sub: string }[] = [
  { id: "schedule", icon: <CalendarDays size={22} />, label: "スケジュール",  sub: "スタッフ予定表" },
  { id: "shipping", icon: <Truck size={22} />,     label: "発注・郵送",   sub: "届け先ごとの発注管理" },
  { id: "master",  icon: <Package size={22} />,    label: "備品マスター", sub: "備品の登録・管理" },
  { id: "fish",    icon: <Fish size={22} />,       label: "魚リスト",     sub: "水族館イベント用" },
  { id: "layout",  icon: <LayoutGrid size={22} />, label: "レイアウト",   sub: "会場配置図" },
  { id: "container", icon: <Boxes size={22} />,    label: "コンテナボックス", sub: "備品の計算・確認" },
  { id: "album",   icon: <Images size={22} />,     label: "アルバム",     sub: "写真フォルダ" },
  { id: "archive", icon: <Archive size={22} />,    label: "アーカイブ",   sub: "終了したイベント" },
];

const MORE_VIEW_IDS = new Set<ViewMode>(MORE_ITEMS.map(i => i.id));

export default function MobileBottomNav({ view, onSetView }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_VIEW_IDS.has(view);

  const handleTab = (id: ViewMode | 'more', e?: React.MouseEvent) => {
    if (id === 'more') {
      setMoreOpen(true);
      return;
    }
    if (e) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      burstAt(r.left + r.width / 2, r.top + r.height / 2, 4);
    }
    setMoreOpen(false);
    onSetView(id);
  };

  const handleMoreSelect = (id: ViewMode, e?: React.MouseEvent) => {
    if (e) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      burstAt(r.left + r.width / 2, r.top + r.height / 2, 4);
    }
    setMoreOpen(false);
    onSetView(id);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur-md z-20 md:hidden"
      >
        <div className="flex items-stretch justify-around px-1">
          {PRIMARY_TABS.map(tab => {
            const active = tab.id === 'more' ? isMoreActive : view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={(e) => handleTab(tab.id, e)}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[3.25rem] py-2 text-[11px] font-bold transition-colors active:scale-95 ${
                  active ? 'text-indigo-600' : 'text-slate-500'
                }`}
              >
                {tab.icon}
                <span className="leading-none">{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {createPortal(
        <AnimatePresence>
          {moreOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMoreOpen(false)}
              />
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 md:hidden flex flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-9 h-1 rounded-full bg-slate-300" />
                </div>
                <div className="flex items-center justify-between px-5 py-2 shrink-0">
                  <h2 className="text-sm font-black text-slate-900">メニュー</h2>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                    aria-label="閉じる"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-y-auto px-4 pb-2 space-y-1.5 max-h-[60dvh]">
                  {MORE_ITEMS.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => handleMoreSelect(item.id, e)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.98] ${
                        view === item.id
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`shrink-0 ${view === item.id ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-900">{item.label}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">{item.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
