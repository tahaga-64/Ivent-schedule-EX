import { useState, useMemo, useEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { REGION_STYLE, TYPE_STYLE, DEPT_OPTIONS, DEPT_TO_REGION } from './constants';
import { Event } from './types';
import { Calendar, List, Menu, X, ChevronLeft, ChevronRight, StickyNote, ClipboardList, Save, Plus, Filter, Search, Camera, Image, BarChart3, Package, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PreparationList from './components/PreparationList';
import PhotoUpload from './components/photos/PhotoUpload';
import PhotoGallery from './components/photos/PhotoGallery';
import MobilePhotoCapture from './components/photos/MobilePhotoCapture';
import BulkActionBar from './components/bulk/BulkActionBar';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import NotificationCenter from './components/notifications/NotificationCenter';
import { useDebounce } from './hooks/useDebounce';
import { useBulkSelection } from './hooks/useBulkSelection';
import { notifyEventCreated, notifyEventUpdated } from './lib/notifications';

/* ═══════════════════════════════════════
   ヘルパー
═══════════════════════════════════════ */
const rs = (r: string) => REGION_STYLE[r] || { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", calBg: "rgba(241, 245, 249, 0.4)", calBorder: "#cbd5e1" };
const ts = (t: string) => TYPE_STYLE[t] || { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", icon: "📋" };
const fmtShort = (d: string) => { if (!d) return "—"; const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };
const fmtRange = (start: string, end?: string) => {
  if (!start) return "—";
  if (!end || start === end) return fmtShort(start);
  return `${fmtShort(start)}-${fmtShort(end)}`;
};
const getMonth = (d: string) => { if (!d) return null; return parseInt(d.split("-")[1]); };

function eventCoversDay(ev: Event, day: Date) {
  if (!ev.start) return false;
  const t = new Date(day); t.setHours(0, 0, 0, 0);
  const s = new Date(ev.start); s.setHours(0, 0, 0, 0);
  if (ev.end) {
    const e = new Date(ev.end); e.setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  }
  return t.getTime() === s.getTime();
}

function assignEventLanes(segments: { ev: Event; start: number; end: number }[]) {
  const sorted = [...segments].sort((a, b) => a.start - b.start || a.end - b.end);
  const lanes: typeof segments[] = [];
  const placed: { seg: (typeof segments)[0]; lane: number }[] = [];
  for (const seg of sorted) {
    let laneIdx = -1;
    for (let i = 0; i < lanes.length; i++) {
      const ok = lanes[i].every((s) => seg.end < s.start || seg.start > s.end);
      if (ok) {
        laneIdx = i;
        break;
      }
    }
    if (laneIdx === -1) {
      lanes.push([seg]);
      laneIdx = lanes.length - 1;
    } else {
      lanes[laneIdx].push(seg);
    }
    placed.push({ seg, lane: laneIdx });
  }
  return placed;
}

function statusDisplay(ev: Event): string {
  const s = ev.status;
  if (!s || s === "planning") return "SCHEDULED";
  if (s === "preparing") return "PREPARING";
  if (s === "in-progress") return "IN PROGRESS";
  if (s === "completed") return "COMPLETED";
  if (s === "cancelled") return "CANCELLED";
  return String(s).toUpperCase();
}

export default function App() {
  const [view, setView] = useState<"calendar" | "list" | "analytics">(() => (localStorage.getItem('viewMode') as any) || "calendar");
  const [workspaceFilter, setWorkspaceFilter] = useState<"all" | "prep" | "stock">("all");
  const [regionFilter, setRegionFilter] = useState(() => localStorage.getItem('regionFilter') || "すべて");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem('typeFilter') || "すべて");
  const [monthFilter, setMonthFilter] = useState(() => localStorage.getItem('monthFilter') || "すべて");
  const [calYear, setCalYear] = useState(() => {
    const val = parseInt(localStorage.getItem('calYear') || "2026");
    return isNaN(val) ? 2026 : val;
  });
  const [calMonth, setCalMonth] = useState(() => {
    const val = parseInt(localStorage.getItem('calMonth') || "5");
    return isNaN(val) ? 5 : val;
  });
  const [selected, setSelected] = useState<Event | null>(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrepList, setShowPrepList] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'photos' | 'camera'>('details');
  const [showMobileCamera, setShowMobileCamera] = useState(false);
  const [eventStats, setEventStats] = useState({ itemCount: 0, preparedCount: 0, budget: 0 });
  const [dbEvents, setDbEvents] = useState<Record<string, Event>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastEditedId, setLastEditedId] = useState<string | null>(() => localStorage.getItem('lastEditedId'));
  
  // Bulk selection
  const bulkSelection = useBulkSelection();
  
  const handleBulkUpdate = useCallback(() => {
    // Force refresh of events data
    window.location.reload();
  }, []);
  const [sidebarTypes, setSidebarTypes] = useState<{label: string, icon: string}[]>(() => {
    const saved = localStorage.getItem('sidebarTypes');
    return saved ? JSON.parse(saved) : [
      { label: "職業体験", icon: "🎓" },
      { label: "水族館", icon: "🐟" },
      { label: "忍者", icon: "🥷" },
      { label: "DJI", icon: "🚁" },
      { label: "超メタフェス", icon: "🎆" },
      { label: "ワークショップ", icon: "🔨" },
    ];
  });

  useEffect(() => {
    localStorage.setItem('sidebarTypes', JSON.stringify(sidebarTypes));
  }, [sidebarTypes]);

  // Firestoreから書き換えられたイベントデータを購読
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      const data: Record<string, Event> = {};
      snapshot.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Event;
      });
      setDbEvents(data);
    });
    return () => unsubscribe();
  }, []);

  // ダークモードの切り替え
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // 選択イベントの準備物統計をリアルタイム購読
  useEffect(() => {
    if (!selected) {
      setEventStats({ itemCount: 0, preparedCount: 0, budget: 0 });
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, `events/${selected.id}/preparationItems`),
      (snapshot) => {
        const items = snapshot.docs.map(d => d.data() as any);
        setEventStats({
          itemCount: items.length,
          preparedCount: items.filter((i: any) => i.prepared).length,
          budget: items.reduce((s: number, i: any) => s + (i.amount || 0) + (i.shippingFee || 0), 0),
        });
      }
    );
    return () => unsubscribe();
  }, [selected?.id]);

  useEffect(() => {
    localStorage.setItem('viewMode', view);
    localStorage.setItem('regionFilter', regionFilter);
    localStorage.setItem('typeFilter', typeFilter);
    localStorage.setItem('monthFilter', monthFilter);
    localStorage.setItem('calMonth', calMonth.toString());
    localStorage.setItem('calYear', calYear.toString());
    if (lastEditedId) localStorage.setItem('lastEditedId', lastEditedId);
  }, [view, regionFilter, typeFilter, monthFilter, calMonth, calYear, lastEditedId]);

  // サイドバーの月フィルターとカレンダーの表示月を連動させる
  useEffect(() => {
    if (monthFilter !== "すべて") {
      const m = parseInt(monthFilter);
      if (!isNaN(m)) {
        setCalMonth(m);
      }
    }
  }, [monthFilter]);

  // Firestoreのイベントデータをソートして取得
  const allEvents = useMemo((): Event[] => {
    return (Object.values(dbEvents) as Event[]).sort((a, b) =>
      (a.start || '9999') < (b.start || '9999') ? -1 : 1
    );
  }, [dbEvents]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEvents.filter(d => {
      if (workspaceFilter === "prep") {
        const s = d.status;
        if (!(s === "preparing" || s === "planning" || s === undefined)) return false;
      }
      if (workspaceFilter === "stock") {
        if (d.status !== "in-progress") return false;
      }
      if (regionFilter !== "すべて" && d.region !== regionFilter) return false;
      if (typeFilter !== "すべて" && d.type !== typeFilter) return false;
      if (monthFilter !== "すべて") {
        const m = parseInt(monthFilter);
        if (getMonth(d.start) !== m && getMonth(d.end) !== m) return false;
      }
      if (q && !d.venue.toLowerCase().includes(q) && !(d.client || "").toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.start || "9999") < (b.start || "9999") ? -1 : 1);
  }, [allEvents, workspaceFilter, regionFilter, typeFilter, monthFilter, searchQuery]);

  const stats = useMemo(() => {
    const byRegion: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let prepCount = 0;
    let stockCount = 0;

    allEvents.forEach(d => {
      if (d.region) byRegion[d.region] = (byRegion[d.region] || 0) + 1;
      if (d.type) byType[d.type] = (byType[d.type] || 0) + 1;
      const s = d.status;
      if (s === "preparing" || s === "planning" || s === undefined) prepCount++;
      if (s === "in-progress") stockCount++;
    });

    return { total: allEvents.length, byRegion, byType, prepCount, stockCount };
  }, [allEvents]);

  const handleUpdateEvent = (id: string, updates: Partial<Event>) => {
    // 選択中のイベントをベースに更新
    if (!selected || selected.id !== id) return;
    
    const newEvent = { ...selected, ...updates };

    // モーダルの表示（state）を即座に更新して入力をサクサクにする
    setSelected(newEvent);
    // 変更ありフラグを立てる
    setHasUnsavedChanges(true);
  };

  const handleSaveEvent = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const isNewEvent = !allEvents.some(event => event.id === selected.id);
      
      await setDoc(doc(db, "events", selected.id), selected);
      setHasUnsavedChanges(false);
      setLastEditedId(selected.id);
      
      // Send notification
      try {
        if (isNewEvent) {
          await notifyEventCreated(selected.id, selected.venue || 'New Event');
        } else {
          await notifyEventUpdated(selected.id, selected.venue || 'Event', ['詳細']);
        }
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
      }
      
      setTimeout(() => setIsSaving(false), 800);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${selected.id}`);
      setIsSaving(false);
    }
  };

  const handleCreateEvent = async (initialData: Partial<Event> = {}) => {
    const id = crypto.randomUUID();
    const newEvent: Event = {
      id,
      venue: initialData.venue || "新しいイベント",
      start: initialData.start || new Date().toISOString().split('T')[0],
      end: initialData.end || initialData.start || new Date().toISOString().split('T')[0],
      region: initialData.region || "東日本",
      dept: "",
      type: initialData.type || "その他",
      client: "",
      note: "",
      emoji: initialData.emoji || "📅"
    };
    try {
      await setDoc(doc(db, "events", id), newEvent);
      setSelected(newEvent);
      setLastEditedId(id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-slate-800 transition-colors duration-300">
      {/* Header */}
      <header className="h-[56px] shrink-0 flex items-center justify-between gap-4 px-4 lg:px-6 bg-white border-b border-[#E5E7EB] sticky top-0 z-30">
        {/* Left: menu (mobile) + logo */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <button type="button" className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" aria-label="メニュー">
            <Menu size={18} />
          </button>
          <div className="w-9 h-9 rounded-lg bg-[#4F46E5] flex items-center justify-center text-white font-bold text-xs shrink-0">EX</div>
          <div className="hidden sm:block min-w-0">
            <div className="font-bold text-[15px] text-slate-900 leading-tight tracking-tight">Ivent Manager</div>
            <div className="text-[11px] text-slate-400 font-medium leading-tight">Preparation & Scheduling</div>
          </div>
        </div>

        {/* Center: search */}
        <div className="flex-1 flex justify-center max-w-2xl mx-auto min-w-0 px-2">
          <div className="flex items-center gap-2.5 w-full bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Search size={16} className="text-slate-400 shrink-0 stroke-[1.75]" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="会場・クライアントを検索..."
              className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 outline-none"
            />
            <kbd className="hidden sm:inline text-[11px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">⌘K</kbd>
          </div>
        </div>

        {/* Right: views + CTA + notifications + avatar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <div className="flex bg-[#F3F4F6] p-1 rounded-xl border border-[#E5E7EB]/80">
              {([
                { id: "calendar" as const, icon: <Calendar size={15} strokeWidth={1.75} />, label: "カレンダー" },
                { id: "list" as const, icon: <List size={15} strokeWidth={1.75} />, label: "リスト" },
              ]).map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all
                  ${view === v.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.06]" : "text-slate-500 hover:text-slate-700"}
                `}
                >
                  {v.icon}
                  <span className="hidden md:inline">{v.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setView("analytics")}
                className={`
                  lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all
                  ${view === "analytics" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.06]" : "text-slate-500 hover:text-slate-700"}
                `}
              >
                <BarChart3 size={15} strokeWidth={1.75} />
                <span className="hidden md:inline">分析</span>
              </button>
            </div>
            <button
              type="button"
              aria-label="分析"
              onClick={() => setView("analytics")}
              className={`hidden lg:inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
                view === "analytics"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.06] border-[#E5E7EB]"
                  : "border-transparent text-slate-500 hover:bg-white hover:border-[#E5E7EB] hover:text-slate-700"
              }`}
            >
              <BarChart3 size={17} strokeWidth={1.75} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleCreateEvent()}
            className="sm:hidden w-10 h-10 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-sm shadow-indigo-500/25"
            aria-label="新規イベント"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => handleCreateEvent()}
            className="hidden sm:flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="font-semibold tracking-tight">+ 新規イベント</span>
          </button>

          <NotificationCenter />

          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-[13px] ring-2 ring-white border border-[#E5E7EB]">
            T
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — desktop */}
        <aside className="w-[272px] flex-col flex-shrink-0 bg-white border-r border-[#E5E7EB] overflow-y-auto hidden lg:flex">
          <div className="p-5 space-y-6">
            {/* TODAY */}
            <div className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-[#E5E7EB]/80">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em]">TODAY</div>
              <div className="text-[42px] font-bold text-slate-900 tracking-tight leading-none mt-1 tabular-nums">
                {new Date().getDate()}
              </div>
              <div className="text-[13px] font-medium text-slate-500 mt-1">
                {new Date().toLocaleDateString("ja-JP", { month: "long", weekday: "long" })}
              </div>
            </div>

            {/* WORKSPACE */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em] mb-2 px-1">WORKSPACE</div>
              <div className="flex flex-col gap-0.5">
                {([
                  {
                    label: "すべてのイベント",
                    icon: <Calendar size={16} strokeWidth={1.75} className="text-[#4F46E5]" />,
                    count: stats.total,
                    onClick: () => {
                      setWorkspaceFilter("all");
                      setRegionFilter("すべて");
                      setTypeFilter("すべて");
                      setMonthFilter("すべて");
                    },
                    active: workspaceFilter === "all",
                  },
                  {
                    label: "準備中",
                    icon: <ClipboardList size={16} strokeWidth={1.75} className="text-[#4F46E5]" />,
                    count: stats.prepCount,
                    onClick: () => setWorkspaceFilter("prep"),
                    active: workspaceFilter === "prep",
                  },
                  {
                    label: "入荷待ち",
                    icon: <Package size={16} strokeWidth={1.75} className="text-[#4F46E5]" />,
                    count: stats.stockCount,
                    onClick: () => setWorkspaceFilter("stock"),
                    active: workspaceFilter === "stock",
                  },
                ]).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                      item.active ? "bg-[#EDE9FE] text-[#5B21B6]" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={item.active ? "text-[#6D28D9]" : "text-[#4F46E5]/70"}>{item.icon}</span>
                      <span className={`text-[13px] font-semibold truncate ${item.active ? "text-[#5B21B6]" : ""}`}>{item.label}</span>
                    </span>
                    <span className={`text-[12px] font-semibold tabular-nums shrink-0 ml-2 ${item.active ? "text-[#7C3AED]" : "text-slate-400"}`}>
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* REGION */}
            <div>
              <div className="flex items-baseline justify-between gap-2 px-1 mb-2">
                <span className="text-[11px] font-bold text-slate-700">本部</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">REGION</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(["すべて", "東日本", "西日本", "南日本", "中日本"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegionFilter(r)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                      regionFilter === r ? "bg-[#EDE9FE] text-[#5B21B6]" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-black/[0.06]"
                        style={{ background: rs(r).dot }}
                      />
                      <span className={`text-[13px] font-semibold truncate ${regionFilter === r ? "text-[#5B21B6]" : ""}`}>{r}</span>
                    </span>
                    {r !== "すべて" && (
                      <span className={`text-[12px] font-semibold tabular-nums shrink-0 ml-2 ${regionFilter === r ? "text-[#7C3AED]" : "text-slate-400"}`}>
                        {stats.byRegion[r] ?? 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* TYPE */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2 gap-2">
                <span className="text-[11px] font-bold text-slate-700 shrink-0">種別</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">TYPE</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newType = prompt("新しい案件種別を入力してください:");
                      if (newType) {
                        const icon = prompt("絵文字アイコンを入力してください (任意):", "📋") || "📋";
                        setSidebarTypes((prev) => [...prev, { label: newType, icon }]);
                      }
                    }}
                    className="p-1 rounded-lg text-[#4F46E5]/60 hover:bg-[#EDE9FE] hover:text-[#5B21B6] transition-colors shrink-0"
                    aria-label="種別を追加"
                  >
                    <Plus size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setTypeFilter("すべて")}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    typeFilter === "すべて" ? "bg-[#EDE9FE] text-[#5B21B6]" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base leading-none">📁</span>
                  <span className={`text-[13px] font-semibold ${typeFilter === "すべて" ? "text-[#5B21B6]" : ""}`}>すべて</span>
                </button>
                {sidebarTypes.map((type) => (
                  <button
                    key={type.label}
                    type="button"
                    onClick={() => setTypeFilter(type.label)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      typeFilter === type.label ? "bg-[#EDE9FE] text-[#5B21B6]" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base leading-none w-6 text-center">{type.icon}</span>
                    <span className={`text-[13px] font-semibold truncate ${typeFilter === type.label ? "text-[#5B21B6]" : ""}`}>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 min-h-0 bg-[#F8F9FA] flex flex-col lg:p-5 overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col bg-white lg:rounded-2xl lg:border lg:border-[#E5E7EB] lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          {/* Sync Indicator */}
          <AnimatePresence>
            {isSaving && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-10 right-10 z-[100] flex items-center gap-3 bg-zinc-900 dark:bg-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 pointer-events-none"
              >
                <div className="relative flex items-center justify-center">
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }} 
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute w-2 h-2 bg-white rounded-full blur-[2px]"
                  />
                  <div className="relative w-1.5 h-1.5 bg-white rounded-full" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cloud Syncing...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={view + regionFilter + typeFilter + monthFilter + workspaceFilter}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {view === "calendar" && (
                <CalendarView
                  events={filtered}
                  year={calYear} month={calMonth}
                  setYear={setCalYear} setMonth={setCalMonth}
                  onSelect={setSelected}
                  onCreateEvent={handleCreateEvent}
                />
              )}
              {view === "list" && (
                filtered.length === 0 ? <EmptyState /> :
                <ListView 
                  data={filtered} 
                  onSelect={setSelected} 
                  lastEditedId={lastEditedId}
                  bulkSelection={bulkSelection}
                  onBulkSelectionChange={handleBulkUpdate}
                />
              )}
              {view === "analytics" && (
                <AnalyticsDashboard />
              )}
            </motion.div>
          </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedEventIds={bulkSelection.selectedIds}
        events={allEvents}
        onClearSelection={bulkSelection.clearSelection}
        onBulkUpdate={handleBulkUpdate}
      />

      {/* Modals */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setShowPrepList(false); setIsEditMode(false); setHasUnsavedChanges(false); setModalTab('details'); setShowMobileCamera(false); }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                width: showPrepList ? '95%' : '520px',
                height: showPrepList ? '90%' : 'auto',
                maxWidth: showPrepList ? '1600px' : '520px'
              }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col border border-gray-100"
            >
              {showPrepList ? (
                <PreparationList
                  event={selected}
                  onBack={() => setShowPrepList(false)}
                />
              ) : (
                <div className="flex flex-col h-full max-h-[90vh]">
                  {/* Header: タグ + 閉じるボタン */}
                  <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex gap-2 flex-wrap">
                      {isEditMode ? (
                        <>
                          <select
                            value={selected.dept || ""}
                            onChange={e => {
                              const dept = e.target.value;
                              const region = DEPT_TO_REGION[dept] || selected.region;
                              handleUpdateEvent(selected.id, { dept, region });
                            }}
                            className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">地域を選択...</option>
                            {DEPT_OPTIONS.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={selected.type || ""}
                            onChange={e => handleUpdateEvent(selected.id, { type: e.target.value })}
                            placeholder="種別を入力..."
                            className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                          />
                        </>
                      ) : (
                        <>
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ background: rs(selected.region).bg, color: rs(selected.region).text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: rs(selected.region).dot }}></span>
                            {selected.dept || selected.region}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                            {ts(selected.type || "").icon} {selected.type || "その他"}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => { setSelected(null); setShowPrepList(false); setIsEditMode(false); setHasUnsavedChanges(false); setModalTab('details'); setShowMobileCamera(false); }}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex border-b border-gray-100">
                    <button
                      onClick={() => setModalTab('details')}
                      className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                        modalTab === 'details'
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <StickyNote size={16} className="inline mr-2" />
                      詳細
                    </button>
                    <button
                      onClick={() => setModalTab('photos')}
                      className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                        modalTab === 'photos'
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Image size={16} className="inline mr-2" />
                      写真 {selected.photos?.length ? `(${selected.photos.length})` : ''}
                    </button>
                    <button
                      onClick={() => setModalTab('camera')}
                      className={`px-6 py-3 text-sm font-medium transition-colors relative md:hidden ${
                        modalTab === 'camera'
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Camera size={16} className="inline mr-2" />
                      カメラ
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto">
                    {modalTab === 'details' && (
                      <div className="p-6">
                        {/* フィールド */}
                        <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">VENUE・会場</label>
                      {isEditMode ? (
                        <input
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selected.venue}
                          placeholder="会場を入力..."
                          onChange={e => handleUpdateEvent(selected.id, { venue: e.target.value })}
                        />
                      ) : (
                        <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800">
                          {selected.venue || "—"}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">START</label>
                        {isEditMode ? (
                          <input
                            type="date"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selected.start}
                            onChange={e => handleUpdateEvent(selected.id, { start: e.target.value })}
                          />
                        ) : (
                          <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800">
                            {selected.start || "—"}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">END</label>
                        {isEditMode ? (
                          <input
                            type="date"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selected.end}
                            onChange={e => handleUpdateEvent(selected.id, { end: e.target.value })}
                          />
                        ) : (
                          <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800">
                            {selected.end || "—"}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">CLIENT・クライアント</label>
                      {isEditMode ? (
                        <input
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selected.client}
                          placeholder="クライアント名を入力..."
                          onChange={e => handleUpdateEvent(selected.id, { client: e.target.value })}
                        />
                      ) : (
                        <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800">
                          {selected.client || "—"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">NOTES・備考</label>
                      {isEditMode ? (
                        <textarea
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
                          value={selected.note}
                          placeholder="メモ..."
                          onChange={e => handleUpdateEvent(selected.id, { note: e.target.value })}
                        />
                      ) : (
                        <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 min-h-[60px]">
                          {selected.note || "—"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 統計パネル */}
                  <div className="mt-6 bg-gray-50 rounded-2xl p-5 grid grid-cols-3 divide-x divide-gray-200">
                    <div className="pr-5">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ITEMS</div>
                      <div className="text-2xl font-black text-gray-800">{eventStats.itemCount}</div>
                    </div>
                    <div className="px-5">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PREPARED</div>
                      <div className="text-2xl font-black text-indigo-600">
                        {eventStats.preparedCount}/{eventStats.itemCount}
                      </div>
                    </div>
                    <div className="pl-5">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">BUDGET</div>
                      <div className="text-2xl font-black text-gray-800">¥{eventStats.budget.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* ボタン */}
                  <div className="mt-6 flex gap-3">
                    {isEditMode ? (
                      <button
                        onClick={async () => { await handleSaveEvent(); setIsEditMode(false); }}
                        disabled={isSaving}
                        className="flex-1 py-4 rounded-2xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-lg shadow-amber-500/20"
                      >
                        <Save size={16} />
                        {isSaving ? "保存中..." : "保存する"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditMode(true)}
                        className="flex-1 py-4 rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        編集
                      </button>
                    )}
                    <button
                      onClick={() => setShowPrepList(true)}
                      className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                    >
                      <ClipboardList size={18} />
                      準備物リストを開く
                    </button>
                  </div>
                      </div>
                    )}

                    {modalTab === 'photos' && (
                      <div className="p-6 space-y-6">
                        <PhotoUpload 
                          eventId={selected.id}
                          onPhotoUploaded={() => {
                            // Force re-fetch of event data to get updated photos
                            window.location.reload();
                          }}
                        />
                        <PhotoGallery 
                          eventId={selected.id}
                          photos={selected.photos || []}
                          onPhotosChange={() => {
                            // Force re-fetch of event data
                            window.location.reload();
                          }}
                        />
                      </div>
                    )}

                    {modalTab === 'camera' && (
                      <div className="h-full">
                        <MobilePhotoCapture 
                          eventId={selected.id}
                          onPhotoUploaded={() => {
                            setModalTab('photos');
                            // Force re-fetch of event data
                            window.location.reload();
                          }}
                          onClose={() => setModalTab('details')}
                        />
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {hasUnsavedChanges && isEditMode && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="text-[10px] text-center text-amber-500 mt-4 font-bold tracking-widest"
                      >
                        ⚠️ 未保存の変更があります
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════
   サブコンポーネント (Updated for Dark Mode)
═══════════════════════════════════════ */

function CalendarView({ events, year, month, setYear, setMonth, onSelect, onCreateEvent }: any) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; current: boolean; fullDate: Date }[] = [];

  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    cells.push({ day, current: false, fullDate: new Date(year, month - 2, day) });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, fullDate: new Date(year, month - 1, d) });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false, fullDate: new Date(year, month, i) });
  }

  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const prevMonth = () => {
    if (month === 1) {
      setYear((y: number) => y - 1);
      setMonth(12);
    } else setMonth((m: number) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y: number) => y + 1);
      setMonth(1);
    } else setMonth((m: number) => m + 1);
  };
  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const segmentsForWeek = (weekCells: typeof cells) => {
    const segments: { ev: Event; start: number; end: number }[] = [];
    for (const ev of events as Event[]) {
      let start = -1;
      let end = -1;
      weekCells.forEach((cell, idx) => {
        if (!eventCoversDay(ev, cell.fullDate)) return;
        if (start === -1) start = idx;
        end = idx;
      });
      if (start !== -1) segments.push({ ev, start, end });
    }
    return assignEventLanes(segments);
  };

  const laneH = 26;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 shrink-0">
        <h2 className="text-[26px] font-bold text-slate-900 tracking-tight">
          {monthNames[month]} <span className="text-slate-400 font-semibold">{year}</span>
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-slate-50 transition-colors"
          >
            <Filter size={15} strokeWidth={1.75} className="text-slate-400" />
            フィルター
          </button>

          <div className="flex items-center rounded-xl border border-[#E5E7EB] bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <button type="button" onClick={prevMonth} className="p-2 text-slate-400 hover:text-[#4F46E5] transition-colors rounded-lg hover:bg-slate-50" aria-label="前月">
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <button type="button" onClick={goToday} className="px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
              今日
            </button>
            <button type="button" onClick={nextMonth} className="p-2 text-slate-400 hover:text-[#4F46E5] transition-colors rounded-lg hover:bg-slate-50" aria-label="翌月">
              <ChevronRight size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] overflow-hidden bg-white flex-1 flex flex-col min-h-[480px]">
        <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#FAFAFB]">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
            <div key={d} className="py-2.5 px-3 border-r border-[#E5E7EB] last:border-r-0">
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  i === 0 ? "text-[#DC2626]" : i === 6 ? "text-[#2563EB]" : "text-slate-400"
                }`}
              >
                {d}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          {weeks.map((week, wi) => {
            const placed = segmentsForWeek(week);
            const maxLane = placed.reduce((m, p) => Math.max(m, p.lane), -1);
            const lanesUsed = maxLane + 1;
            const rowMin = Math.max(152, 44 + Math.max(1, lanesUsed) * laneH + 52);

            return (
              <div
                key={wi}
                className="relative grid grid-cols-7 border-b border-[#E5E7EB] last:border-b-0"
                style={{ minHeight: rowMin }}
              >
                {week.map((cell, di) => {
                  const isSat = di === 6;
                  const isSun = di === 0;
                  const isToday = sameDay(cell.fullDate, today);

                  let dayNumClass = "text-[12px] font-semibold tabular-nums ";
                  if (!cell.current) dayNumClass += "text-slate-300";
                  else if (isToday) dayNumClass += "text-white";
                  else if (isSun) dayNumClass += "text-[#DC2626]";
                  else if (isSat) dayNumClass += "text-[#2563EB]";
                  else dayNumClass += "text-slate-800";

                  return (
                    <div
                      key={`${wi}-${di}`}
                      className={`relative z-[1] flex flex-col border-r border-[#E5E7EB] last:border-r-0 group/cell ${cell.current ? "bg-white" : "bg-[#FAFAFB]"}`}
                    >
                      <div className="flex items-start justify-start px-2 pt-2">
                        <span
                          className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1 ${isToday && cell.current ? "bg-[#8B5CF6] shadow-sm" : ""}`}
                        >
                          <span className={dayNumClass}>{cell.day}</span>
                        </span>
                      </div>

                      <div className="flex-1 min-h-[88px]" />

                      <div className="p-2 pt-0 mt-auto">
                        {cell.current && (
                          <button
                            type="button"
                            title="イベントを追加"
                            onClick={() =>
                              onCreateEvent({
                                start: `${year}-${String(month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`,
                              })
                            }
                            className="flex w-full items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] py-2 text-slate-300 opacity-0 transition-all hover:border-[#C4B5FD] hover:text-[#7C3AED] group-hover/cell:opacity-100"
                          >
                            <Plus size={14} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="pointer-events-none absolute left-0 right-0 top-[38px] bottom-11 z-[2] px-1">
                  {placed.map(({ seg, lane }) => {
                    const accent = rs(seg.ev.region || "").dot || ts(seg.ev.type || "").border || "#94a3b8";
                    const span = seg.end - seg.start + 1;
                    return (
                      <button
                        key={`${seg.ev.id}-${wi}-${lane}-${seg.start}`}
                        type="button"
                        onClick={() => onSelect(seg.ev)}
                        style={{
                          top: lane * laneH,
                          left: `calc(${(seg.start / 7) * 100}% + 6px)`,
                          width: `calc(${(span / 7) * 100}% - 12px)`,
                        }}
                        className="pointer-events-auto absolute flex h-[22px] items-center gap-1.5 overflow-hidden rounded-md border border-[#E5E7EB] bg-[#F3F4F6] pl-2 pr-2 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors hover:bg-[#EEF2FF]"
                      >
                        <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md" style={{ background: accent }} />
                        <span className="relative z-[1] ml-1 shrink-0 text-[12px] leading-none">{seg.ev.emoji || ts(seg.ev.type || "").icon}</span>
                        <span className="relative z-[1] truncate text-[11px] font-semibold text-slate-700">{seg.ev.venue}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function ListView({ 
  data, 
  onSelect, 
  lastEditedId, 
  bulkSelection,
  onBulkSelectionChange 
}: any) {
  const eventIds = data.map((d: any) => d.id);
  
  const handleRowClick = (event: any, eventData: any) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd click for multi-select
      bulkSelection.toggleSelection(eventData.id);
      onBulkSelectionChange?.();
    } else if (event.shiftKey && bulkSelection.selectedIds.length > 0) {
      // Shift click for range select
      const lastSelectedIndex = eventIds.indexOf(bulkSelection.selectedIds[bulkSelection.selectedIds.length - 1]);
      const currentIndex = eventIds.indexOf(eventData.id);
      
      if (lastSelectedIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        const rangeIds = eventIds.slice(start, end + 1);
        bulkSelection.selectMultiple(rangeIds);
        onBulkSelectionChange?.();
      } else {
        bulkSelection.toggleSelection(eventData.id);
        onBulkSelectionChange?.();
      }
    } else {
      // Normal click
      if (bulkSelection.selectedIds.length > 0) {
        // If in bulk mode, toggle selection
        bulkSelection.toggleSelection(eventData.id);
        onBulkSelectionChange?.();
      } else {
        // Open event modal
        onSelect(eventData);
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          All events<span className="text-slate-400 font-semibold"> · </span>
          <span className="tabular-nums text-slate-400 font-semibold">{data.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-slate-50 transition-colors"
          >
            <Filter size={15} strokeWidth={1.75} className="text-slate-400" />
            フィルター
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-slate-50 transition-colors"
          >
            <ArrowUpDown size={15} strokeWidth={1.75} className="text-slate-400" />
            並び替え
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <table className="w-full min-w-[880px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB]">
              <th className="w-10 px-3 py-4 lg:w-11">
                <span className="sr-only">選択</span>
                <input
                  type="checkbox"
                  checked={bulkSelection.isAllSelected(eventIds)}
                  onChange={() => {
                    bulkSelection.toggleAllSelection(eventIds);
                    onBulkSelectionChange?.();
                  }}
                  className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#4F46E5] focus:ring-[#4F46E5]/30"
                  aria-label="すべて選択"
                />
              </th>
              {[
                { k: "DATE", w: "w-[100px]" },
                { k: "本部", w: "min-w-[120px]" },
                { k: "種別", w: "min-w-[140px]" },
                { k: "会場", w: "" },
                { k: "状態", w: "w-[120px] text-right" },
              ].map((col) => (
                <th
                  key={col.k}
                  className={`px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${col.w}`}
                >
                  {col.k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d: any) => {
              const isSelected = bulkSelection.isSelected(d.id);
              return (
                <tr
                  key={d.id}
                  onClick={(e) => handleRowClick(e, d)}
                  className={`group cursor-pointer border-b border-[#E5E7EB] transition-colors last:border-b-0 ${
                    isSelected ? "bg-[#F5F3FF]" : d.id === lastEditedId ? "bg-amber-50/80" : "hover:bg-slate-50/80"
                  }`}
                >
                  <td className="px-3 py-5 align-top">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        bulkSelection.toggleSelection(d.id);
                        onBulkSelectionChange?.();
                      }}
                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#4F46E5] focus:ring-[#4F46E5]/30"
                      aria-label={`${d.venue} を選択`}
                    />
                  </td>
                  <td className="px-4 py-5 align-top tabular-nums">
                    <span className="text-[13px] font-medium text-slate-600">{fmtRange(d.start, d.end)}</span>
                  </td>
                  <td className="px-4 py-5 align-top">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{ background: rs(d.region).bg, color: rs(d.region).text }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: rs(d.region).dot }} />
                      {d.region}
                    </span>
                  </td>
                  <td className="px-4 py-5 align-top">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      <span className="text-[14px] leading-none">{d.emoji || ts(d.type || "").icon}</span>
                      <span className="truncate">{d.type || "その他"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-5 align-top">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-slate-900 leading-snug tracking-tight">{d.venue}</div>
                        <div className="mt-1 text-[12px] font-medium text-slate-500">{d.client || "—"}</div>
                      </div>
                      {d.id === lastEditedId && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="mt-0.5 shrink-0 rounded-md bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm"
                        >
                          New
                        </motion.span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-5 align-top text-right">
                    <span className="text-[11px] font-medium tracking-wide text-slate-400">{statusDisplay(d)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function FilterGroup({ label, options, value, onChange }: any) {
  return (
    <div className="space-y-4">
      <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 opacity-60">{label}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt: any) => (
          <motion.button
            key={opt}
            whileHover={{ x: 4, backgroundColor: "rgba(245, 158, 11, 0.05)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(opt)}
            className={`
              w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border border-transparent
              ${value === opt 
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20 border-amber-500/20" 
                : "text-[var(--text-secondary)] hover:text-amber-500"}
            `}
          >
            {opt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-zinc-700">
      <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
        <Calendar size={32} />
      </div>
      <div className="text-sm font-bold text-slate-400 dark:text-zinc-600">イベントが見つかりません</div>
    </div>
  );
}
