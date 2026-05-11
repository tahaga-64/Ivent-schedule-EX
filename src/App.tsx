import { useState, useMemo, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { DATA, REGION_STYLE, TYPE_STYLE, DAYS_JP } from './constants';
import { Event } from './types';
import { Calendar, List, Menu, X, ChevronLeft, ChevronRight, MapPin, Building2, StickyNote, ClipboardList, Moon, Sun, Save, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PreparationList from './components/PreparationList';

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
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [regionFilter, setRegionFilter] = useState("すべて");
  const [typeFilter, setTypeFilter] = useState("すべて");
  const [monthFilter, setMonthFilter] = useState("すべて");
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(5);
  const [selected, setSelected] = useState<Event | null>(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [showPrepList, setShowPrepList] = useState(false);
  const [dbEvents, setDbEvents] = useState<Record<string, Event>>({});

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
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // 静的データとDBデータをマージ
  const allEvents = useMemo(() => {
    return DATA.map(item => dbEvents[item.id] || item);
  }, [dbEvents]);

  const regions = ["すべて", "東日本", "西日本", "南日本", "中日本"];
  const types = ["すべて", ...Array.from(new Set(DATA.map(d => d.type)))];
  const months = ["すべて", "5月", "6月", "7月", "8月"];

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
    filtered.forEach(d => { byRegion[d.region] = (byRegion[d.region] || 0) + 1; });
    return { total: filtered.length, byRegion };
  }, [filtered]);

  const handleUpdateEvent = async (id: string, updates: Partial<Event>) => {
    const base = dbEvents[id] || DATA.find(d => d.id === id);
    if (!base) return;
    const newEvent = { ...base, ...updates };
    try {
      await setDoc(doc(db, "events", id), newEvent);
      setSelected(newEvent);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${id}`);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen transition-colors duration-300">
      {/* Header */}
      <header className="glass-card px-5 h-14 flex items-center justify-between sticky top-0 z-30 transition-colors">
        <div className="flex items-center gap-3">
          <button onClick={() => setSideOpen(!sideOpen)} className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] cursor-pointer flex items-center justify-center text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-purple-accent flex items-center justify-center text-white font-black text-xs shadow-purple-accent/40 shadow-lg">EX</div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm text-[var(--text-primary)] leading-tight">EVENT MANAGER</div>
            <div className="text-[10px] text-[var(--text-secondary)] tracking-wider uppercase font-black">Preparation & Scheduling</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            {[
              { id: "calendar", icon: <Calendar size={14} />, label: "カレンダー" },
              { id: "list", icon: <List size={14} />, label: "リスト" },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id as any)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${view === v.id ? 'bg-white dark:bg-zinc-700 text-purple-accent shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}
                `}
              >
                {v.icon}
                <span className="hidden md:inline">{v.label}</span>
              </button>
            ))}
          </div>

          <button 
            onClick={() => setIsDark(!isDark)}
            className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all shadow-sm"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {sideOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="glass-card flex flex-col flex-shrink-0 transition-colors z-20"
            >
              <div className="p-5 space-y-6 overflow-y-auto">
                {/* Today Display */}
                <div className="space-y-1 py-4 border-b border-[var(--border)]">
                  <div className="text-[10px] font-black text-purple-accent uppercase tracking-widest">TODAY</div>
                  <div className="text-4xl font-black text-[var(--text-primary)]">
                    {new Date().getDate()}
                  </div>
                  <div className="text-xs font-bold text-[var(--text-secondary)]">
                    {new Date().toLocaleDateString('ja-JP', { month: 'long', weekday: 'long' })}
                  </div>
                </div>

                <div className="bg-purple-accent rounded-2xl p-4 text-center text-white shadow-xl shadow-purple-accent/30 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-100%] group-hover:translate-x-[100%] duration-1000"></div>
                  <div className="text-3xl font-black leading-none">{stats.total}</div>
                  <div className="text-[10px] opacity-80 mt-1 uppercase tracking-widest font-bold">Items count</div>
                </div>

                <div className="space-y-1">
                  {Object.entries(stats.byRegion).map(([r, n]) => {
                    const s = rs(r);
                    return (
                      <div key={r} className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-50/50 dark:bg-zinc-800/30 border border-transparent hover:border-[var(--border)] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shadow-sm" style={{ background: s.dot }}></span>
                          <span className="text-xs font-bold text-[var(--text-secondary)]">{r}</span>
                        </div>
                        <span className="text-xs font-black text-[var(--text-primary)]">{n}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="h-px bg-[var(--border)] my-4"></div>

                <FilterGroup label="本部" options={regions} value={regionFilter} onChange={setRegionFilter} />
                <FilterGroup label="月" options={months} value={monthFilter} onChange={setMonthFilter} />
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">種別</div>
                    <button 
                      onClick={() => handleCreateEvent()}
                      className="p-1 hover:bg-purple-accent/10 rounded-md text-purple-accent transition-colors"
                      title="新規イベント"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {types.map((opt: any) => (
                      <button
                        key={opt}
                        onClick={() => setTypeFilter(opt)}
                        className={`
                          w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all
                          ${typeFilter === opt 
                            ? "bg-purple-accent/10 border border-purple-accent/20 text-purple-accent shadow-sm" 
                            : "text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-[var(--text-primary)]"}
                        `}
                      >
                        {opt}
                      </button>
                    ))}
                    <button
                      onClick={() => handleCreateEvent()}
                      className="w-full flex items-center gap-3 px-3 py-3 mt-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-accent hover:bg-purple-accent/10 transition-all border border-dashed border-purple-accent/30"
                    >
                      <Plus size={14} strokeWidth={3} />
                      新規イベント作成
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
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
                />
              )}
              {view === "list" && (
                filtered.length === 0 ? <EmptyState /> :
                <ListView data={filtered} onSelect={setSelected} />
              )}
            </motion.div>
          </AnimatePresence>
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
              onClick={() => { setSelected(null); setShowPrepList(false); }}
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
                        {ts(selected.type).icon} {selected.type}
                      </span>
                    </div>
                    <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-colors">
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

                  <button 
                    onClick={() => setShowPrepList(true)}
                    className="w-full bg-purple-accent text-white flex items-center justify-center gap-3 py-5 rounded-[2rem] font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-accent/30"
                  >
                    <ClipboardList size={22} />
                    準備物リストを開く
                  </button>
                  <p className="text-[10px] text-center text-[var(--text-secondary)] mt-6 font-bold tracking-widest opacity-60">REAL-TIME SYNC ACTIVE</p>
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
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 1) { setYear((y: any) => y - 1); setMonth(12); } else setMonth((m: any) => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear((y: any) => y + 1); setMonth(1); } else setMonth((m: any) => m + 1); };

  const today = new Date();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-6">
          <div className="flex bg-[var(--surface)] p-1 rounded-2xl border border-[var(--border)] shadow-sm">
            <button onClick={prevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{year}年 {month}月</div>
        </div>
        <div className="hidden lg:flex gap-2">
          {Object.entries(REGION_STYLE).map(([r, s]) => (
            <span key={r} className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-black shadow-sm" style={{ background: s.bg, color: s.text }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }}></span>{r}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px mb-4 bg-[var(--border)] border border-[var(--border)] rounded-3xl overflow-hidden">
        {DAYS_JP.map((d, i) => (
          <div key={d} className={`bg-[var(--surface)] text-center py-4 text-[10px] font-black uppercase tracking-widest ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-[var(--text-secondary)] opacity-50"}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="h-36"></div>;
          const dayEvents = events.filter(ev => eventCoversDate(ev, year, month, day));
          const isToday = today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;
          const isSun = idx % 7 === 0, isSat = idx % 7 === 6;

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          return (
            <div 
              key={day} 
              onClick={() => dayEvents.length === 0 && onCreateEvent({ start: dateStr })}
              className={`
                h-36 bg-[var(--surface)] rounded-3xl border p-3 overflow-hidden transition-all group relative cursor-default
                ${isToday ? "ring-4 ring-purple-accent/10 border-purple-accent" : "border-[var(--border)] hover:scale-[1.02] hover:shadow-xl dark:hover:border-[var(--primary)]"}
              `}
            >
              <div className={`
                w-8 h-8 flex items-center justify-center text-xs font-black rounded-xl mb-3 transition-colors
                ${isToday ? "bg-purple-accent text-white shadow-lg shadow-purple-accent/30" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-[var(--text-primary)]"}
              `}>{day}</div>

              <div className="space-y-1.5 relative z-10">
                {dayEvents.slice(0, 3).map(ev => (
                  <div 
                    key={ev.id} 
                    onClick={(e) => { e.stopPropagation(); onSelect(ev); }}
                    className="
                      text-[9px] font-black py-2 px-3 rounded-xl cursor-pointer truncate transition-all shadow-sm
                      dark:shadow-neon-purple/20 border-l-[4px] bg-slate-50 dark:bg-zinc-800/50 hover:brightness-110
                    "
                    style={{ color: rs(ev.region).text, borderLeftColor: rs(ev.region).dot }}
                  >
                    <span className="mr-1">{ev.emoji || ts(ev.type).icon}</span> {ev.venue}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-[9px] font-black text-slate-300 dark:text-zinc-600 ml-1">+{dayEvents.length - 3} more</div>}
              </div>

              {dayEvents.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity pointer-events-none">
                  <Plus size={48} className="text-purple-accent" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ data, onSelect }: any) {
  return (
    <div className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] shadow-xl overflow-hidden transition-colors">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-[var(--border)]">
          <tr>
            {["日程", "本部", "種別", "会場"].map(h => (
              <th key={h} className="px-8 py-5 font-black text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {data.map((d: any) => (
            <tr key={d.id} onClick={() => onSelect(d)} className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
              <td className="px-8 py-6">
                <span className="font-mono text-xs font-black text-[var(--text-secondary)]">{fmtShort(d.start)}{d.start !== d.end && d.end ? `〜${fmtShort(d.end)}` : ""}</span>
              </td>
              <td className="px-8 py-6">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black shadow-sm" style={{ background: rs(d.region).bg, color: rs(d.region).text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: rs(d.region).dot }}></span>{d.region}
                </span>
              </td>
              <td className="px-8 py-6">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border bg-[var(--bg-app)] border-[var(--border)] text-[var(--text-secondary)]">
                  {d.emoji || ts(d.type).icon} {d.type}
                </span>
              </td>
              <td className="px-8 py-6">
                <div className="font-bold text-[var(--text-primary)] text-sm">{d.venue}</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1 font-medium">{d.client || "—"}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: any) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-2 mb-2">{label}</div>
      <div className="flex flex-col gap-1">
        {options.map((opt: any) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`
              w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all
              ${value === opt 
                ? "bg-purple-accent/10 border border-purple-accent/20 text-purple-accent shadow-sm" 
                : "text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-[var(--text-primary)]"}
            `}
          >
            {opt}
          </button>
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
