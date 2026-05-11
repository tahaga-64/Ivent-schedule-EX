import { useState, useMemo, useEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { DATA, REGION_STYLE, TYPE_STYLE, DAYS_JP } from './constants';
import { Event } from './types';
import { Calendar, List, Menu, X, ChevronLeft, ChevronRight, MapPin, Building2, StickyNote, ClipboardList, Moon, Sun, Save, Plus, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PreparationList from './components/PreparationList';
import { useDebounce } from './hooks/useDebounce';

/* ═══════════════════════════════════════
   ヘルパー
═══════════════════════════════════════ */
const rs = (r: string) => REGION_STYLE[r] || { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", calBg: "rgba(241, 245, 249, 0.4)", calBorder: "#cbd5e1" };
const ts = (t: string) => TYPE_STYLE[t] || { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", icon: "📋" };
const fmtShort = (d: string) => { if (!d) return "—"; const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };
const getMonth = (d: string) => { if (!d) return null; return parseInt(d.split("-")[1]); };

function eventCoversDate(ev: Event, y: number, m: number, day: number) {
  if (!ev.start) return false;
  const s = new Date(ev.start); s.setHours(0, 0, 0, 0);
  const t = new Date(y, m - 1, day);
  
  if (ev.end) {
    const e = new Date(ev.end); e.setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  }
  return t.getTime() === s.getTime();
}

export default function App() {
  const [view, setView] = useState<"calendar" | "list">(() => (localStorage.getItem('viewMode') as any) || "calendar");
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
  const [showPrepList, setShowPrepList] = useState(false);
  const [dbEvents, setDbEvents] = useState<Record<string, Event>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastEditedId, setLastEditedId] = useState<string | null>(() => localStorage.getItem('lastEditedId'));
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

  // 静的データとDBデータをマージ
  const allEvents = useMemo(() => {
    return DATA.map(item => dbEvents[item.id] || item);
  }, [dbEvents]);

  const filtered = useMemo(() => {
    return allEvents.filter(d => {
      if (regionFilter !== "すべて" && d.region !== regionFilter) return false;
      if (typeFilter !== "すべて" && d.type !== typeFilter) return false;
      if (monthFilter !== "すべて") {
        const m = parseInt(monthFilter);
        if (getMonth(d.start) !== m && getMonth(d.end) !== m) return false;
      }
      return true;
    }).sort((a, b) => (a.start || "9999") < (b.start || "9999") ? -1 : 1);
  }, [allEvents, regionFilter, typeFilter, monthFilter]);

  const stats = useMemo(() => {
    const byRegion: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = { "準備中": 0, "入荷待ち": 0 };
    
    allEvents.forEach(d => { 
      if (d.region) byRegion[d.region] = (byRegion[d.region] || 0) + 1;
      if (d.type) byType[d.type] = (byType[d.type] || 0) + 1;
    });

    filtered.forEach(d => {
      if (d.status) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });

    return { total: allEvents.length, byRegion, byType, byStatus };
  }, [allEvents, filtered]);

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
      await setDoc(doc(db, "events", selected.id), selected);
      setHasUnsavedChanges(false);
      setLastEditedId(selected.id);
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
    <div className="flex flex-col min-h-screen transition-colors duration-300">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-indigo-200 shadow-lg">EX</div>
            <div>
              <div className="font-bold text-sm text-slate-800 leading-tight">Ivent Manager</div>
              <div className="text-[10px] text-slate-400 font-bold tracking-tight">Preparation & Scheduling</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {[
              { id: "calendar", icon: <Calendar size={15} />, label: "カレンダー" },
              { id: "list", icon: <List size={15} />, label: "リスト" },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id as any)}
                className={`
                  flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${view === v.id ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}
                `}
              >
                {v.icon}
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <button 
            onClick={() => handleCreateEvent()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-indigo-200 shadow-lg"
          >
            <Plus size={16} strokeWidth={3} />
            <span>新規イベント</span>
          </button>

          <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs ring-2 ring-white ml-2">T</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 flex flex-col flex-shrink-0 bg-slate-50/50 border-r border-slate-100 overflow-y-auto hidden lg:flex">
          <div className="p-6 space-y-8">
            {/* TODAY Section */}
            <div className="space-y-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TODAY</div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="text-4xl font-black text-slate-800 tracking-tighter leading-none">
                  {new Date().getDate()}
                </div>
                <div className="text-xs font-bold text-slate-500">
                  {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}
                </div>
              </div>
            </div>

            {/* WORKSPACE Section */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WORKSPACE</div>
              <div className="flex flex-col gap-0.5">
                {[
                  { label: "すべてのイベント", icon: <Calendar size={14} />, count: stats.total, value: "すべて" },
                  { label: "準備中", icon: <ClipboardList size={14} />, count: stats.byStatus["準備中"], value: "準備中" },
                  { label: "入荷待ち", icon: <Building2 size={14} />, count: stats.byStatus["入荷待ち"], value: "入荷待ち" },
                ].map((item) => (
                  <button 
                    key={item.label} 
                    onClick={() => {
                      setRegionFilter("すべて");
                      setTypeFilter("すべて");
                      setMonthFilter("すべて");
                      // ステータスフィルターがあればここに追加
                    }}
                    className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:border-slate-100 border border-transparent transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-indigo-600 opacity-60 group-hover:opacity-100">{item.icon}</span>
                      <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600 font-sans">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* REGION Section */}
            <div className="space-y-3">
              <div className="text-[10px] items-center flex justify-between font-black text-slate-400 uppercase tracking-widest px-1">
                <span>REGION</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {[
                  { label: "すべて" },
                  { label: "東日本" },
                  { label: "西日本" },
                  { label: "南日本" },
                  { label: "中日本" },
                ].map((r) => (
                  <button 
                    key={r.label} 
                    onClick={() => setRegionFilter(r.label)}
                    className={`
                      group flex items-center justify-between px-3 py-2 rounded-xl transition-all border
                      ${regionFilter === r.label 
                        ? "bg-white border-slate-100 shadow-sm text-indigo-600" 
                        : "border-transparent text-slate-500 hover:bg-white hover:border-slate-100"}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full" style={{ background: rs(r.label).dot }}></span>
                      <span className="text-xs font-bold font-sans">{r.label}</span>
                    </div>
                    <span className="text-xs font-bold opacity-60 font-sans">{r.label === "すべて" ? "" : (stats.byRegion[r.label] || 0)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TYPE Section */}
            <div className="space-y-3 pt-4">
              <div className="text-[10px] items-center flex justify-between font-black text-slate-400 uppercase tracking-widest px-1">
                <span>TYPE</span>
                <button 
                  onClick={() => {
                    const newType = prompt("新しい案件種別を入力してください:");
                    if (newType) {
                      const icon = prompt("絵文字アイコンを入力してください (任意):", "📋") || "📋";
                      setSidebarTypes(prev => [...prev, { label: newType, icon }]);
                    }
                  }}
                  className="p-1 hover:bg-indigo-50 rounded text-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                <button 
                  onClick={() => setTypeFilter("すべて")}
                  className={`
                    group flex items-center gap-3 px-3 py-2 rounded-xl transition-all border
                    ${typeFilter === "すべて" 
                      ? "bg-white border-slate-100 shadow-sm text-indigo-600" 
                      : "border-transparent text-slate-500 hover:bg-white hover:border-slate-100"}
                  `}
                >
                  <span className="text-sm">📁</span>
                  <span className="text-xs font-bold font-sans">すべて</span>
                </button>
                {sidebarTypes.map((type) => (
                  <button 
                    key={type.label} 
                    onClick={() => setTypeFilter(type.label)}
                    className={`
                      group flex items-center gap-3 px-3 py-2 rounded-xl transition-all border
                      ${typeFilter === type.label 
                        ? "bg-white border-slate-100 shadow-sm text-indigo-600" 
                        : "border-transparent text-slate-500 hover:bg-white hover:border-slate-100"}
                    `}
                  >
                    <span className="text-sm">{type.icon}</span>
                    <span className="text-xs font-bold font-sans">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white relative overflow-hidden flex flex-col">
          <div className="p-8 flex-1 overflow-y-auto">
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
              key={view + regionFilter + typeFilter + monthFilter}
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
                  lastEditedId={lastEditedId}
                />
              )}
              {view === "list" && (
                filtered.length === 0 ? <EmptyState /> :
                <ListView data={filtered} onSelect={setSelected} lastEditedId={lastEditedId} />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setShowPrepList(false); setHasUnsavedChanges(false); }}
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
              className="bg-[var(--surface)] rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-[var(--border)]"
            >
              {showPrepList ? (
                <PreparationList 
                  event={selected} 
                  onBack={() => setShowPrepList(false)} 
                />
              ) : (
                <div className="p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex gap-2 flex-wrap">
                      <span 
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm"
                        style={{ background: rs(selected.region).bg, color: rs(selected.region).text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: rs(selected.region).dot }}></span>
                        {selected.region}{selected.dept ? ` · ${selected.dept}` : ""}
                      </span>
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black border bg-[var(--bg-app)] border-[var(--border)] text-[var(--text-secondary)]">
                          {ts(selected.type || "").icon} {selected.type || "その他"}
                        </span>
                    </div>
                    <button onClick={() => { setSelected(null); setHasUnsavedChanges(false); }} className="w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-6 mb-8">
                    <div className="flex gap-4">
                      <div className="w-24">
                        <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 px-2">絵文字</div>
                        <input 
                          className="w-full bg-[var(--bg-app)] border-none rounded-2xl px-2 py-4 text-3xl text-center focus:ring-2 focus:ring-purple-accent outline-none font-bold"
                          value={selected.emoji || "📅"}
                          onChange={e => handleUpdateEvent(selected.id, { emoji: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 px-2">会場名</div>
                        <input 
                          className="w-full bg-[var(--bg-app)] border-none rounded-2xl px-5 py-4 text-base font-black text-[var(--text-primary)] focus:ring-2 focus:ring-purple-accent outline-none"
                          value={selected.venue}
                          placeholder="会場を入力..."
                          onChange={e => handleUpdateEvent(selected.id, { venue: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 px-2">開始日</div>
                        <input 
                          type="date"
                          className="w-full bg-[var(--bg-app)] border-none rounded-2xl px-5 py-4 text-sm font-mono font-black text-[var(--text-primary)] focus:ring-2 focus:ring-purple-accent outline-none"
                          value={selected.start}
                          onChange={e => handleUpdateEvent(selected.id, { start: e.target.value })}
                        />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 px-2">終了日</div>
                        <input 
                          type="date"
                          className="w-full bg-[var(--bg-app)] border-none rounded-2xl px-5 py-4 text-sm font-mono font-black text-[var(--text-primary)] focus:ring-2 focus:ring-purple-accent outline-none"
                          value={selected.end}
                          onChange={e => handleUpdateEvent(selected.id, { end: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 px-2">クライアント</div>
                      <input 
                        className="w-full bg-[var(--bg-app)] border-none rounded-2xl px-5 py-4 text-base font-bold text-[var(--text-primary)] focus:ring-2 focus:ring-purple-accent outline-none"
                        value={selected.client}
                        placeholder="クライアント名を入力..."
                        onChange={e => handleUpdateEvent(selected.id, { client: e.target.value })}
                      />
                    </div>

                    <div>
                      <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 px-2">備考</div>
                      <textarea 
                        className="w-full bg-[var(--bg-app)] border-none rounded-2xl px-5 py-4 text-sm font-bold text-[var(--text-primary)] focus:ring-2 focus:ring-purple-accent outline-none min-h-[100px]"
                        value={selected.note}
                        placeholder="メモ..."
                        onChange={e => handleUpdateEvent(selected.id, { note: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 items-center mt-8">
                    <button 
                      disabled={!hasUnsavedChanges || isSaving}
                      onClick={handleSaveEvent}
                      className={`
                        flex-1 flex items-center justify-center gap-3 py-5 rounded-[2rem] font-black transition-all shadow-xl
                        ${hasUnsavedChanges 
                          ? "bg-amber-500 text-white hover:scale-[1.02] active:scale-[0.98] shadow-amber-500/30" 
                          : "bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 cursor-not-allowed border border-[var(--border)]"}
                      `}
                    >
                      <Save size={20} className={hasUnsavedChanges ? "text-white" : "text-slate-400"} />
                      <span className={hasUnsavedChanges ? "text-white" : "text-slate-400"}>
                        {isSaving ? "保存中..." : hasUnsavedChanges ? "変更を保存する" : "変更はありません"}
                      </span>
                    </button>

                    <button 
                      onClick={() => setShowPrepList(true)}
                      className="flex-1 bg-amber-500 text-white flex items-center justify-center gap-3 py-5 rounded-[2rem] font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-amber-500/30"
                    >
                      <ClipboardList size={22} />
                      準備物リスト
                    </button>
                  </div>
                  <AnimatePresence>
                    {hasUnsavedChanges && (
                      <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="text-[10px] text-center text-red-500 mt-6 font-black uppercase tracking-widest"
                      >
                        ⚠️ 未保存の変更があります
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {!hasUnsavedChanges && (
                    <p className="text-[10px] text-center text-[var(--text-secondary)] mt-6 font-bold tracking-widest opacity-60 uppercase">
                      Cloud Synced
                    </p>
                  )}
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

function CalendarView({ events, year, month, setYear, setMonth, onSelect, onCreateEvent, lastEditedId }: any) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  
  // 前月のパディング
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDay - i, current: false });
  }
  
  // 今月の実データ
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  
  // 次月のパディング
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false });
  }

  const prevMonth = () => { if (month === 1) { setYear((y: any) => y - 1); setMonth(12); } else setMonth((m: any) => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear((y: any) => y + 1); setMonth(1); } else setMonth((m: any) => m + 1); };
  const setToday = () => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); };

  const today = new Date();
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {monthNames[month]} <span className="text-slate-400 font-bold ml-1">{year}</span>
          </h2>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <span>フィルター</span>
          </button>
          
          <div className="flex items-center gap-1 ml-2">
            <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft size={20} /></button>
            <button onClick={setToday} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm ml-1 mr-1">今日</button>
            <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-7 border-t border-l border-slate-100">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
          <div key={d} className="border-r border-b border-slate-100 bg-slate-50/10 py-2 px-3">
            <span className={`text-[9px] font-black uppercase tracking-widest ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{d}</span>
          </div>
        ))}
        
        {cells.map((cell, idx) => {
          const isSun = idx % 7 === 0;
          const isToday = cell.current && today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === cell.day;
          const dayEvents = cell.current ? events.filter((ev: any) => eventCoversDate(ev, year, month, cell.day)) : [];
          
          return (
            <div 
              key={idx} 
              className={`
                min-h-[160px] border-r border-b border-slate-100 p-2 group transition-colors
                ${cell.current ? "bg-white" : "bg-slate-50/20"}
                ${isToday ? "bg-indigo-50/10" : ""}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`
                  text-[11px] font-bold px-1.5 py-0.5 rounded
                  ${!cell.current ? "text-slate-300" : isToday ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : isSun ? "text-red-500" : "text-indigo-600"}
                `}>
                  {cell.day}
                </span>
              </div>
              
              <div className="space-y-1">
                {dayEvents.map((ev: any) => (
                  <button
                    key={ev.id}
                    onClick={() => onSelect(ev)}
                    className="w-full text-left bg-blue-50/40 hover:bg-blue-50 transition-colors rounded-md p-1.5 flex items-center gap-2 border border-blue-100/50 group/item relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-md" style={{ background: rs(ev.region || "").dot }}></div>
                    <span className="text-[11px] shrink-0">{ev.emoji || ts(ev.type || "").icon}</span>
                    <span className="text-[10px] font-bold text-slate-700 truncate">{ev.venue}</span>
                  </button>
                ))}
                
                {cell.current && (
                  <button 
                    onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                    className="w-full py-2 opacity-0 group-hover:opacity-100 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-300 hover:border-indigo-300 hover:text-indigo-400 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ListView({ data, onSelect, lastEditedId }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--surface)] rounded-[2rem] border border-[var(--border)] shadow-2xl overflow-hidden transition-all"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border)]">
              {["日程", "本部", "種別", "会場"].map(h => (
                <th key={h} className="px-8 py-5 font-black text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.map((d: any) => (
              <tr 
                key={d.id} 
                onClick={() => onSelect(d)} 
                className={`
                  group cursor-pointer transition-all border-l-4
                  ${d.id === lastEditedId 
                    ? "bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border-amber-500" 
                    : "hover:bg-purple-accent/[0.02] border-transparent"}
                `}
              >
                <td className="px-8 py-7">
                  <div className="font-mono text-xs font-black text-[var(--text-primary)]">
                    {fmtShort(d.start)}
                    {d.start !== d.end && d.end && (
                      <span className="mx-2 text-[var(--text-secondary)] opacity-40">→</span>
                    )}
                    {d.start !== d.end && d.end && fmtShort(d.end)}
                  </div>
                </td>
                <td className="px-8 py-7">
                  <span className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-[10px] font-black border border-transparent shadow-sm" style={{ background: rs(d.region).bg, color: rs(d.region).text }}>
                    <span className="w-1.5 h-1.5 rounded-full shadow-inner" style={{ background: rs(d.region).dot }}></span>
                    {d.region}
                  </span>
                </td>
                <td className="px-8 py-7">
                  <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black border bg-[var(--bg-app)] border-[var(--border)] text-[var(--text-secondary)] shadow-sm">
                    <span className="text-base">{d.emoji || ts(d.type || "").icon}</span>
                    <span className="uppercase tracking-widest">{d.type || "その他"}</span>
                  </span>
                </td>
                <td className="px-8 py-7">
                  <div className="flex items-center gap-3">
                    <div className="font-black text-[var(--text-primary)] text-[15px] tracking-tight group-hover:text-amber-500 transition-colors uppercase">{d.venue}</div>
                    {d.id === lastEditedId && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="px-2 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded-md tracking-widest uppercase shadow-sm shadow-amber-500/20"
                      >
                        Updated
                      </motion.span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 font-bold tracking-wide opacity-70">{d.client || "No Client Specified"}</div>
                </td>
              </tr>
            ))}
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
