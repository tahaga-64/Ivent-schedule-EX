import { useState, useMemo, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { db, auth, loginWithGoogle, firebaseConfigError } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, collectionGroup, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, addDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { DATA, REGION_STYLE, TYPE_STYLE, DAYS_JP, REGIONS } from './constants';
import { Event, PreparationItem, type FieldAuthorAttribution } from './types';

interface StaffMember {
  id: string;
  name: string;
  email?: string;
}
import { Calendar, Menu, X, ChevronLeft, ChevronRight, Building2, ClipboardList, Save, Plus, Search, LogOut, Trash2, Archive, Mail, Moon, Sun, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import AccessDeniedScreen from './components/AccessDeniedScreen';
import PreparationList from './components/PreparationList';
import NotificationCenter from './components/notifications/NotificationCenter';
import PhotoUpload from './components/photos/PhotoUpload';
import PhotoGallery from './components/photos/PhotoGallery';
import { usePhotos } from './hooks/usePhotos';
import { useRoles } from './hooks/useRoles';
import { MAX_PHOTOS } from './lib/photoStorage';
import {
  canEditPreparationList as computeCanEditPreparationList,
} from './lib/permissions';
import Dashboard from './components/Dashboard';
import { recordUserLogin, notifyEventCreated, notifyEventUpdated, notifyEventDeleted, notifyAssigneesAdded } from './lib/notifications';
import { checkUserAllowed } from './lib/allowedUsers';

type ViewMode = "calendar" | "prep" | "archive";
type ModalTab = "detail" | "photos";

// 安全なlocalStorage読み込み
function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

// イベントバリデーション
interface ValidationError {
  field: string;
  message: string;
}

function validateEvent(event: Partial<Event>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!event.venue || event.venue.trim().length === 0) {
    errors.push({ field: 'venue', message: '会場名は必須です' });
  }
  if (event.venue && event.venue.length > 500) {
    errors.push({ field: 'venue', message: '会場名は500文字以内にしてください' });
  }
  if (!event.start) {
    errors.push({ field: 'start', message: '開始日は必須です' });
  }
  if (event.start && event.end && event.start > event.end) {
    errors.push({ field: 'end', message: '終了日は開始日以降にしてください' });
  }
  
  return errors;
}

function buildFieldAttribution(user: User | null): FieldAuthorAttribution | undefined {
  if (!user) return undefined;
  return {
    updatedByUid: user.uid,
    updatedByEmail: user.email ?? null,
    updatedByName: user.displayName ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function formatAttributionLine(meta: FieldAuthorAttribution | undefined): string | null {
  if (!meta?.updatedAt) return null;
  const date = new Date(meta.updatedAt);
  const dateStr = Number.isNaN(date.getTime())
    ? meta.updatedAt
    : date.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
  const name = meta.updatedByName?.trim();
  const email = meta.updatedByEmail?.trim();
  if (name && email) return `最終記入: ${name}（${email}）・${dateStr}`;
  if (email) return `最終記入: ${email}・${dateStr}`;
  if (name) return `最終記入: ${name}・${dateStr}`;
  if (meta.updatedByUid) return `最終記入: UID ${meta.updatedByUid.slice(0, 8)}…・${dateStr}`;
  return `最終記入: ${dateStr}`;
}

/* ═══════════════════════════════════════
   ヘルパー
═══════════════════════════════════════ */
const rs = (r: string) => REGION_STYLE[r] || { bg: "#f1f5f9", text: "#334155", dot: "#94a3b8", calBg: "rgba(241, 245, 249, 0.4)", calBorder: "#cbd5e1" };
const ts = (t: string) => TYPE_STYLE[t] || { bg: "#f8fafc", border: "#64748b", text: "#1e293b", icon: "📋" };
const fmtShort = (d: string) => { if (!d) return "—"; const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };
const DOW_JP = ['日', '月', '火', '水', '木', '金', '土'];
function fmtDateJP(d: string): { month: number; day: number; dow: string; label: string } {
  const date = new Date(d + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = DOW_JP[date.getDay()];
  return { month, day, dow, label: `${month}月${day}日（${dow}）` };
}
function fmtDateRange(start: string, end: string): string {
  const s = fmtDateJP(start);
  if (!end || end === start) return s.label;
  const e = fmtDateJP(end);
  const diffDays = Math.round((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000) + 1;
  return `${s.label} → ${e.month}月${e.day}日（${e.dow}）${diffDays > 1 ? ` · ${diffDays}日間` : ''}`;
}
function daysUntil(start: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(start + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}


function statusStyle(status?: string): { label: string; bg: string; text: string; dot: string } {
  switch (status) {
    case 'in_progress': return { label: '準備中',    bg: 'bg-amber-50',   text: 'text-amber-600',  dot: '#f59e0b' };
    case 'waiting':     return { label: '入荷待ち',  bg: 'bg-blue-50',    text: 'text-blue-600',   dot: '#3b82f6' };
    case 'ready':       return { label: '準備完了',  bg: 'bg-emerald-50', text: 'text-emerald-600',dot: '#10b981' };
    case 'completed':   return { label: '終了',      bg: 'bg-orange-500', text: 'text-white',      dot: '#f97316' };
    case 'cancelled':   return { label: 'キャンセル',bg: 'bg-red-50',     text: 'text-red-500',    dot: '#ef4444' };
    default:            return { label: '予定',      bg: 'bg-slate-50',   text: 'text-slate-400',  dot: '#cbd5e1' };
  }
}
const getMonth = (d: string) => { if (!d) return null; return parseInt(d.split("-")[1]); };

const getDaysInRange = (start: string, end: string): string[] => {
  const days: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const formatDayLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${dow}）`;
};

/** 日セルには出さない: 種別・日付/期間など（日別一覧・ホバー・読み上げ用の任意行） */
function buildEventOptionalCaption(ev: Event, opts?: { includeDates?: boolean }): string {
  const includeDates = opts?.includeDates !== false;
  const parts: string[] = [];
  if (ev.type?.trim()) parts.push(ev.type.trim());
  if (includeDates && ev.start) {
    if (ev.end && ev.end !== ev.start) parts.push(`${fmtShort(ev.start)}–${fmtShort(ev.end)}`);
    else parts.push(fmtShort(ev.start));
  }
  return parts.join(" · ");
}

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

/** 月グリッド用セル列（週ビューで同じ形状を再利用） */
function buildMonthGridCells(year: number, month: number): { day: number; current: boolean }[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; current: boolean }[] = [];
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDay - i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false });
  }
  return cells;
}

/** 開発用: 同一週の連続4日にイベント0/2/4/6件の見え比べ用データ（?calPreview=density） */
function buildCalendarDensityPreviewEvents(
  year: number,
  month: number,
  regionFilter: string,
  typeFilter: string
): Event[] {
  const dim = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const firstMonday = 1 + (1 - firstDow + 7) % 7;
  let d0: number;
  let d1: number;
  let d2: number;
  let d3: number;
  if (firstMonday + 3 <= dim) {
    d0 = firstMonday;
    d1 = firstMonday + 1;
    d2 = firstMonday + 2;
    d3 = firstMonday + 3;
  } else {
    d0 = dim - 3;
    d1 = dim - 2;
    d2 = dim - 1;
    d3 = dim;
  }
  // d0: 同一週の「0件」比較用セル（この日にはプレビューイベントを追加しない）
  void d0;
  const region = regionFilter !== "すべて" ? regionFilter : "関東";
  const type = typeFilter !== "すべて" ? typeFilter : "その他";
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (day: number) => `${year}-${pad(month)}-${pad(day)}`;
  const mk = (suffix: string, day: number, venue: string): Event => ({
    id: `__cal_preview_${suffix}`,
    start: iso(day),
    end: iso(day),
    region,
    dept: "",
    type,
    venue,
    client: "プレビュー",
    note: "",
    emoji: "📐",
  });
  const out: Event[] = [];
  out.push(mk("2a", d1, "密度プレビュー 2件・A"), mk("2b", d1, "密度プレビュー 2件・B"));
  for (let i = 0; i < 4; i++) {
    out.push(mk(`4_${i}`, d2, `密度プレビュー 4件・${i + 1}`));
  }
  for (let i = 0; i < 6; i++) {
    out.push(mk(`6_${i}`, d3, `密度プレビュー 6件・${i + 1}`));
  }
  return out;
}


// 在庫管理アプリのURLが決まったらここに入力する
const INVENTORY_APP_URL = '';

function InventoryAppBanner() {
  const ready = INVENTORY_APP_URL.length > 0;
  return (
    <div className="mt-10 mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 px-6 py-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl shrink-0">📦</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-black text-slate-700">イベント在庫管理</span>
            {!ready && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 uppercase tracking-wide">新機能実装予定</span>
            )}
          </div>
          <p className="text-xs text-slate-400">備品・消耗品の在庫をリアルタイムで管理できる機能を開発中です</p>
        </div>
        {ready ? (
          <a
            href={INVENTORY_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors"
          >
            開く
          </a>
        ) : (
          <button
            disabled
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-100 text-indigo-300 text-xs font-black cursor-not-allowed"
          >
            開く
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [accessDenied, setAccessDenied] = useState(false);
  const [needsNameSetup, setNeedsNameSetup] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved === 'calendar' || saved === 'prep' || saved === 'archive') ? saved : 'calendar';
  });
  const [regionFilter, setRegionFilter] = useState(() => localStorage.getItem('regionFilter') || "すべて");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem('typeFilter') || "すべて");
  const [monthFilter, setMonthFilter] = useState(() => localStorage.getItem('monthFilter') || "すべて");
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calYear, setCalYear] = useState(() => {
    const val = parseInt(localStorage.getItem('calYear') || String(new Date().getFullYear()));
    return isNaN(val) ? new Date().getFullYear() : val;
  });
  const [calMonth, setCalMonth] = useState(() => {
    const val = parseInt(localStorage.getItem('calMonth') || String(new Date().getMonth() + 1));
    return isNaN(val) ? new Date().getMonth() + 1 : val;
  });
  const [selected, setSelected] = useState<Event | null>(null);
  /** カレンダー日セルの「+N件」から開く、その日の全イベント一覧 */
  const [dayDetail, setDayDetail] = useState<{ year: number; month: number; day: number; events: Event[] } | null>(null);
  /** lg 未満のカレンダー画面: 一覧 / 月グリッド / 週 / 日 */
  const [calendarMobileLayout, setCalendarMobileLayout] = useState<"list" | "day">("list");
  const [mobileWeekRowIndex, setMobileWeekRowIndex] = useState(0);
  const [mobileAgendaDay, setMobileAgendaDay] = useState(() => new Date().getDate());
  const [sideOpen, setSideOpen] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches));
  const [searchQuery, setSearchQuery] = useState("");
  const [prepEvent, setPrepEvent] = useState<Event | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('detail');
  const [eventStats, setEventStats] = useState({ itemCount: 0, preparedCount: 0, budget: 0 });
  const [dbEvents, setDbEvents] = useState<Record<string, Event>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const [localDailyRoles, setLocalDailyRoles] = useState<Record<string, Record<string, string>>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastEditedId, setLastEditedId] = useState<string | null>(() => localStorage.getItem('lastEditedId'));
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prepProgressMap, setPrepProgressMap] = useState<Record<string, { total: number; done: number }>>({});
  const [sidebarTypes, setSidebarTypes] = useState<{label: string, icon: string}[]>(() => 
    safeGetItem('sidebarTypes', [
      { label: "職業体験", icon: "🎓" },
      { label: "水族館", icon: "🐟" },
      { label: "忍者", icon: "🥷" },
      { label: "DJI", icon: "🚁" },
      { label: "超メタフェス", icon: "🎆" },
      { label: "ワークショップ", icon: "🔨" },
    ])
  );

  useEffect(() => {
    localStorage.setItem('sidebarTypes', JSON.stringify(sidebarTypes));
  }, [sidebarTypes]);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffExpanded, setStaffExpanded] = useState(false);
  const STAFF_SHOW_COUNT = 5;

  // 未保存変更の警告（ブラウザを閉じる・リロード時）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setNeedsNameSetup(false);
        return;
      }

      const allowed = await checkUserAllowed(u).catch(() => false);
      if (!allowed) {
        setAccessDenied(true);
        await auth.signOut();
        return;
      }

      setAccessDenied(false);
      setUser(u);
      if (!u.displayName?.trim()) {
        setNeedsNameSetup(true);
      } else {
        setNeedsNameSetup(false);
        recordUserLogin(u).catch(error => {
          console.error('User profile upsert error:', error);
        });
        setDoc(doc(db, 'userProfiles', u.uid), {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  // スタッフリスト購読
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'staff'), (snap) => {
      const collator = new Intl.Collator('ja', { sensitivity: 'base' });
      const list: StaffMember[] = snap.docs.map(d => ({ id: d.id, name: d.data().name as string, email: d.data().email as string | undefined }));
      list.sort((a, b) => collator.compare(a.name, b.name));
      setStaffList(list);
    });
    return () => unsubscribe();
  }, []);

  const [narrowViewport, setNarrowViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setNarrowViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const { isEventEditor } = useRoles();
  const canEditEvent = !narrowViewport && !!user && isEventEditor(user.email);
  const canEditPreparationList = computeCanEditPreparationList(user);
  const canUploadPhoto = !!user;

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

  // ダークモードの適用
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // 他ユーザーの変更をモーダルにリアルタイム反映（未保存の編集中は上書きしない）
  useEffect(() => {
    if (!selected || hasUnsavedChangesRef.current) return;
    const latest = dbEvents[selected.id];
    if (latest) setSelected(latest);
  }, [dbEvents, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 日別役割のローカル状態をイベント切替時に初期化（Firestoreの同期と完全に分離）
  useEffect(() => {
    setLocalDailyRoles(selected?.dailyRoles ?? {});
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 選択イベントの準備物統計をリアルタイム購読
  useEffect(() => {
    if (!selected) {
      setEventStats({ itemCount: 0, preparedCount: 0, budget: 0 });
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, `events/${selected.id}/preparationItems`),
      (snapshot) => {
        const items = snapshot.docs.map(d => d.data() as PreparationItem);
        setEventStats({
          itemCount: items.length,
          preparedCount: items.filter(i => i.arrived && i.prepared).length,
          budget: items.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0),
        });
      }
    );
    return () => unsubscribe();
  }, [selected?.id]);

  // 全イベントの準備物進捗マップ（ホバーカード用）
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collectionGroup(db, 'preparationItems'),
      (snapshot) => {
        const map: Record<string, { total: number; done: number }> = {};
        snapshot.docs.forEach(d => {
          const eventId = d.ref.parent.parent?.id;
          if (!eventId) return;
          const item = d.data() as PreparationItem;
          if (!map[eventId]) map[eventId] = { total: 0, done: 0 };
          map[eventId].total += 1;
          if (item.arrived && item.prepared) map[eventId].done += 1;
        });
        setPrepProgressMap(map);
      },
      (error) => {
        console.warn('prepProgressMap subscription error:', error);
      }
    );
    return () => unsubscribe();
  }, [user]);

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

  useEffect(() => {
    const dim = new Date(calYear, calMonth, 0).getDate();
    setMobileAgendaDay((d) => Math.min(Math.max(1, d), dim));
  }, [calYear, calMonth]);

  useEffect(() => {
    const cells = buildMonthGridCells(calYear, calMonth);
    const rows = cells.length / 7;
    setMobileWeekRowIndex((w) => Math.min(Math.max(0, w), rows - 1));
  }, [calYear, calMonth]);

  // 静的データとDBデータをマージ（Firestore上に新規作成されたイベントも含める）
  const allEvents = useMemo(() => {
    const staticIds = new Set(DATA.map(d => d.id));
    const merged = DATA.map(item => dbEvents[item.id] || item);
    const firestoreOnly = Object.values(dbEvents).filter((e: Event) => !staticIds.has(e.id));
    return [...merged, ...firestoreOnly];
  }, [dbEvents]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = allEvents.filter(d => {
      if (regionFilter !== "すべて" && d.region !== regionFilter) return false;
      if (typeFilter !== "すべて" && d.type !== typeFilter) return false;
      if (monthFilter !== "すべて") {
        const m = parseInt(monthFilter);
        if (getMonth(d.start) !== m && getMonth(d.end) !== m) return false;
      }
      if (q && !d.venue.toLowerCase().includes(q) && !(d.client || "").toLowerCase().includes(q)) return false;
      return true;
    });
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ev => (ev.status ?? 'scheduled') === statusFilter);
    }
    return filtered.sort((a, b) => (a.start || "9999") < (b.start || "9999") ? -1 : 1);
  }, [allEvents, regionFilter, typeFilter, monthFilter, searchQuery, statusFilter]);

  const calendarDensityPreview =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("calPreview") === "density";

  const desktopCalendarEvents = useMemo(() => {
    if (!calendarDensityPreview) return filtered;
    const extra = buildCalendarDensityPreviewEvents(calYear, calMonth, regionFilter, typeFilter);
    return [...filtered, ...extra].sort((a, b) =>
      (a.start || "9999") < (b.start || "9999") ? -1 : 1
    );
  }, [filtered, calendarDensityPreview, calYear, calMonth, regionFilter, typeFilter]);

  const {
    uploading: photoUploading,
    uploadProgress,
    error: photoError,
    uploadPhoto,
    deleteEventPhoto,
    updatePhotoCaption
  } = usePhotos(selected?.id || '');

  const stats = useMemo(() => {
    const byRegion: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = { "scheduled": 0, "completed": 0, "cancelled": 0 };

    allEvents.forEach(d => {
      if (d.region) byRegion[d.region] = (byRegion[d.region] || 0) + 1;
      if (d.type) byType[d.type] = (byType[d.type] || 0) + 1;
    });

    filtered.forEach(d => {
      if (d.status && d.status in byStatus) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });

    return { total: allEvents.length, byRegion, byType, byStatus };
  }, [allEvents, filtered]);

  const handleUpdateEvent = (id: string, updates: Partial<Event>) => {
    if (!selected || selected.id !== id) return;
    // 関数型更新で常に最新 state をベースにする（stale closure 防止）
    setSelected(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, ...updates };
    });
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  // Firestoreエラーを日本語のユーザー向けメッセージに整形
  const formatSaveError = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes('permission') || lower.includes('insufficient') || lower.includes('missing or insufficient')) {
      return '保存に失敗しました：権限がありません。編集権限のあるGoogleアカウントでログインしているか確認してください。';
    }
    if (lower.includes('unavailable') || lower.includes('offline') || lower.includes('network')) {
      return '保存に失敗しました：ネットワークに接続できません。接続を確認してから再試行してください。';
    }
    return '保存に失敗しました。もう一度お試しください。';
  };

  const handleSaveEvent = async (): Promise<boolean> => {
    if (!selected) return false;

    // バリデーション実行
    const errors = validateEvent(selected);
    setValidationErrors(errors);
    if (errors.length > 0) {
      return false;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // 写真はarrayUnion/arrayRemoveで別途管理されるため、保存時はDBの最新値を使う
      const latestPhotos = dbEvents[selected.id]?.photos ?? selected.photos;
      // latestPhotos が undefined のとき photos: undefined を Firestore に渡すと
      // Firebase v12 が "Unsupported field value: undefined" で弾くため、undefined の場合はキーごと除外する
      const { photos: _p, ...eventBase } = selected;
      const eventToSave = {
        ...eventBase,
        dailyRoles: localDailyRoles,
        ...(latestPhotos !== undefined ? { photos: latestPhotos } : {}),
      };
      await setDoc(doc(db, "events", selected.id), eventToSave);
      // 楽観的にローカルキャッシュも更新（onSnapshot反映までのラグ対策）
      setDbEvents(prev => ({ ...prev, [selected.id]: eventToSave }));
      setSelected(eventToSave);
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setLastEditedId(selected.id);
      setIsSaving(false);
      if (user) {
        const oldAssignees = dbEvents[selected.id]?.assignees ?? [];
        const newAssignees = selected.assignees ?? [];
        const added = newAssignees.filter(name => !oldAssignees.includes(name));
        if (added.length > 0) {
          const addedStaff = added.map(name => ({
            name,
            email: staffList.find(s => s.name === name)?.email,
          }));
          notifyAssigneesAdded(addedStaff, eventToSave, user).catch(console.error);
        }
        notifyEventUpdated(selected, user).catch(error => {
          console.error('Notification fanout error:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Firestore save error:', error);
      setSaveError(formatSaveError(error));
      setIsSaving(false);
      return false;
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
    setSaveError(null);
    // 楽観的にUIへ反映（保存完了前にも一覧 / モーダルに表示）
    setDbEvents(prev => ({ ...prev, [id]: newEvent }));
    setSelected(newEvent);
    setLastEditedId(id);
    try {
      await setDoc(doc(db, "events", id), newEvent);
      if (user) notifyEventCreated(newEvent, user).catch(console.error);
    } catch (error) {
      console.error('Firestore create error:', error);
      setSaveError(formatSaveError(error));
      // 失敗したらローカルキャッシュからロールバック
      setDbEvents(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSelected(null);
    }
  };

  const handleNotifyEmail = async () => {
    if (!selected || !user) return;
    setIsNotifying(true);
    setNotifyResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/notify-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventVenue: selected.venue,
          eventStart: selected.start,
          eventEnd: selected.end,
          senderName: user.displayName || user.email || '編集者',
        }),
      });
      const data = await res.json() as { sent?: number; error?: string };
      setNotifyResult(res.ok ? `✅ ${data.sent}名にメールを送信しました` : `❌ ${data.error ?? '送信失敗'}`);
    } catch (e) {
      setNotifyResult(`❌ ${String(e)}`);
    }
    setIsNotifying(false);
  };

  const handleDeleteEvent = async () => {
    if (!selected) return;
    if (!canEditEvent) return;
    const confirmed = window.confirm(
      `「${selected.venue}」を削除しますか？\n準備物リストも含めてすべて削除されます。この操作は元に戻せません。`
    );
    if (!confirmed) return;

    const eventId = selected.id;
    const deletedVenue = selected.venue;
    const eventSnapshot = { ...selected };

    // モーダルを即座に閉じ、UIから楽観的に削除
    setSelected(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setModalTab('detail');
    setDbEvents(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    try {
      // イベント本体を先に削除（先に削除することで部分失敗による準備物消失を防ぐ）
      await deleteDoc(doc(db, 'events', eventId));

      // preparationItems サブコレクションを削除（ベストエフォート）
      const prepPath = `events/${eventId}/preparationItems`;
      const prepSnapshot = await getDocs(collection(db, prepPath));
      await Promise.all(prepSnapshot.docs.map(d => deleteDoc(d.ref)));
      if (user) notifyEventDeleted(deletedVenue, eventId, user).catch(console.error);
    } catch (error) {
      console.error('Delete error:', error);
      setDbEvents(prev => ({ ...prev, [eventId]: eventSnapshot }));
      setSelected(eventSnapshot);
      alert('削除に失敗しました。もう一度お試しください。');
    }
  };

  // 種別削除：該当種別を持つイベントのtypeをFirestoreから一括クリア
  const handleDeleteType = async (label: string) => {
    const affected = allEvents.filter(e => e.type === label);
    const msg = affected.length > 0
      ? `「${label}」を削除します。\nこの種別が設定されている ${affected.length} 件のイベントから種別をクリアします。\n続行しますか？`
      : `「${label}」を削除しますか？`;
    if (!window.confirm(msg)) return;

    if (affected.length > 0) {
      const batch = writeBatch(db);
      for (const ev of affected) {
        batch.set(doc(db, 'events', ev.id), { type: '' }, { merge: true });
      }
      try {
        await batch.commit();
        setDbEvents(prev => {
          const next = { ...prev };
          for (const ev of affected) {
            next[ev.id] = { ...(next[ev.id] ?? ev), type: '' };
          }
          return next;
        });
        if (selected?.type === label) {
          setSelected(prev => prev ? { ...prev, type: '' } : prev);
        }
      } catch (error) {
        console.error('Type cascade delete error:', error);
        alert('種別削除中にエラーが発生しました。もう一度お試しください。');
        return;
      }
    }

    setSidebarTypes(prev => prev.filter(t => t.label !== label));
    if (typeFilter === label) setTypeFilter('すべて');
  };

  const handleAddStaff = async () => {
    const name = prompt('スタッフ名を入力してください:');
    const trimmed = name?.trim() ?? '';
    if (!trimmed || trimmed.length > 50) return;
    if (staffList.some(s => s.name === trimmed)) { alert('その名前は既に登録されています'); return; }
    const emailInput = prompt('Gmailアドレスを入力してください（省略可）:') ?? '';
    const emailTrimmed = emailInput.trim();
    const staffData: Record<string, unknown> = { name: trimmed, createdAt: serverTimestamp() };
    if (emailTrimmed) staffData.email = emailTrimmed;
    try {
      await addDoc(collection(db, 'staff'), staffData);
    } catch {
      alert('スタッフの追加に失敗しました');
    }
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (!window.confirm(`「${staff.name}」を削除しますか？`)) return;
    try {
      await deleteDoc(doc(db, 'staff', staff.id));
    } catch {
      alert('スタッフの削除に失敗しました');
    }
  };

  const handleEditStaffEmail = async (staff: StaffMember) => {
    const input = prompt(`「${staff.name}」のGmailアドレスを設定してください（削除する場合は空白）:`, staff.email ?? '');
    if (input === null) return;
    const trimmed = input.trim();
    try {
      await updateDoc(doc(db, 'staff', staff.id), { email: trimmed || deleteField() });
    } catch {
      alert('メールアドレスの更新に失敗しました');
    }
  };

  // モーダルを閉じる（未保存の変更がある場合は確認）
  const handleCloseModal = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!window.confirm('未保存の変更があります。破棄しますか？')) {
        return;
      }
    }
    setSelected(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setModalTab('detail');
  }, [hasUnsavedChanges]);

  const handleEventHover = (ev: Event, e: ReactMouseEvent<HTMLElement>) => {
    if (ev.id.startsWith("__cal_preview_")) return;
    if (window.innerWidth < 1024) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const { clientX, clientY } = e;
    hoverTimer.current = setTimeout(() => {
      setHoverPos({ x: clientX, y: clientY });
      setHoveredEvent(ev);
    }, 300);
  };

  const handleEventHoverEnd = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoveredEvent(null);
  };

  const handleEventSelect = (ev: Event) => {
    handleEventHoverEnd();
    if (ev.id.startsWith("__cal_preview_")) return;
    setSelected(ev);
    setNotifyResult(null);
  };

  const handleOpenDayDetail = useCallback((ctx: { year: number; month: number; day: number; events: Event[] }) => {
    handleEventHoverEnd();
    setDayDetail(ctx);
  }, []);

  const handleCloseDayDetail = useCallback(() => {
    setDayDetail(null);
  }, []);

  const handlePickEventFromDayDetail = (ev: Event) => {
    if (ev.id.startsWith("__cal_preview_")) return;
    handleEventHoverEnd();
    setDayDetail(null);
    setSelected(ev);
  };

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  if (firebaseConfigError) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-4">🔧</div>
        <h1 className="text-xl font-black text-slate-800 mb-2">Firebase 設定が不足しています</h1>
        <p className="text-sm text-slate-500 mb-4">Vercel の Environment Variables に以下を追加してください:</p>
        <pre className="text-left text-xs bg-slate-100 rounded-xl p-4 mb-6 overflow-auto text-red-600">
{`VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_ID`}
        </pre>
        <p className="text-xs text-slate-400">{firebaseConfigError}</p>
      </div>
    </div>
  );
  if (accessDenied) return (
    <AccessDeniedScreen
      email={auth.currentUser?.email ?? null}
      onRetry={() => setAccessDenied(false)}
    />
  );
  if (user === undefined) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <LoginScreen />;
  if (needsNameSetup) return (
    <ProfileSetupScreen
      user={user}
      onComplete={() => {
        setNeedsNameSetup(false);
        recordUserLogin(user).catch(error => {
          console.error('User profile upsert error:', error);
        });
      }}
    />
  );

  return (
    <div className="flex flex-col min-h-screen transition-colors duration-300">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-100 sticky top-0 z-30 gap-4">
        {/* 左: ハンバーガー + ロゴ */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button onClick={() => setSideOpen(v => !v)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-indigo-200 shadow-md">EX</div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm text-slate-800 leading-tight">Ivent Manager</div>
            <div className="text-[10px] text-slate-400 font-bold tracking-tight">Preparation & Scheduling</div>
          </div>
          <div className="sm:hidden flex flex-col">
            <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{calYear}年{calMonth}月</div>
            <div className="font-black text-sm text-slate-800 leading-tight">{view === 'calendar' ? 'カレンダー' : view === 'prep' ? '準備物リスト' : view === 'archive' ? 'アーカイブ' : ''}</div>
          </div>
        </div>

        {/* 中央: 検索バー */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="会場・クライアントを検索..."
              className="flex-1 bg-transparent text-xs text-slate-600 placeholder-slate-400 outline-none"
            />
            <kbd className="hidden sm:block text-[10px] text-slate-400 font-medium bg-slate-200 px-1.5 py-0.5 rounded">⌘K</kbd>
          </div>
        </div>

        {/* 右: ビュー切替 + 新規 + アバター */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: "calendar", icon: <Calendar size={14} />, label: "カレンダー" },
                { id: "prep", icon: <ClipboardList size={14} />, label: "準備物" },
                { id: "archive", icon: <Archive size={14} />, label: "アーカイブ" },
              ] as { id: ViewMode; icon: React.ReactNode; label: string }[]
            ).map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${view === v.id ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}
                `}
              >
                {v.icon}
                <span className="hidden md:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {!narrowViewport && (
          <button
            onClick={() => handleCreateEvent()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-indigo-200 shadow-md"
          >
            <Plus size={14} strokeWidth={3} />
            <span className="hidden sm:inline">新規イベント</span>
          </button>
          )}

          <NotificationCenter />

          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-white" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs ring-2 ring-white">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <button
              onClick={() => setIsDark(v => !v)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-indigo-500 transition-colors"
              title={isDark ? 'ライトモード' : 'ダークモード'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={() => auth.signOut()} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-400 transition-colors" title="ログアウト">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sideOpen && <aside className="w-72 flex flex-col flex-shrink-0 bg-white border-r border-slate-100 overflow-y-auto hidden lg:flex">
          <div className="p-6 space-y-8">
            {/* TODAY Section */}
            <div className="space-y-2 pb-4 border-b border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TODAY</div>
              <div className="text-4xl font-black text-slate-800 tracking-tighter leading-none">
                {new Date().getDate()}
              </div>
              <div className="text-xs font-bold text-slate-500">
                {new Date().toLocaleDateString('ja-JP', { month: 'long', weekday: 'long' })}
              </div>
            </div>

            {/* WORKSPACE Section */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WORKSPACE</div>
              <div className="flex flex-col gap-0.5">
                {[
                  { label: "すべてのイベント", icon: <Calendar size={14} />, count: stats.total, statusValue: "all" },
                  { label: "準備中", icon: <ClipboardList size={14} />, count: stats.byStatus["準備中"], statusValue: "in_progress" },
                  { label: "入荷待ち", icon: <Building2 size={14} />, count: stats.byStatus["入荷待ち"], statusValue: "waiting" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setRegionFilter("すべて");
                      setTypeFilter("すべて");
                      setMonthFilter("すべて");
                      setStatusFilter(item.statusValue);
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
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-700">本部</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">REGION</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(["すべて", ...REGIONS] as const).map((label) => (
                  <button
                    key={label}
                    onClick={() => setRegionFilter(label)}
                    className={`
                      group flex items-center justify-between px-3 py-2 rounded-lg transition-all
                      ${regionFilter === label
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100/70"}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: rs(label).dot }}></span>
                      <span className="text-xs font-bold font-sans">{label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400 font-sans">{label === "すべて" ? "" : (stats.byRegion[label] || 0)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TYPE Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-700">種別</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TYPE</span>
                  <button
                    onClick={() => {
                    const newType = prompt("新しい案件種別を入力してください:");
                    const trimmed = newType?.trim() ?? '';
                    if (!trimmed || trimmed.length > 50) return;
                    if (sidebarTypes.some(t => t.label === trimmed)) { alert('その種別は既に存在します'); return; }
                    const icon = prompt("絵文字アイコンを入力してください (任意):", "📋") || "📋";
                    setSidebarTypes(prev => [...prev, { label: trimmed, icon }]);
                  }}
                  className="p-1 hover:bg-indigo-50 rounded text-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus size={12} />
                </button>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <button 
                  onClick={() => setTypeFilter("すべて")}
                  className={`
                    group flex items-center gap-3 px-3 py-2 rounded-lg transition-all
                    ${typeFilter === "すべて"
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100/70"}
                  `}
                >
                  <span className="text-sm">📁</span>
                  <span className="text-xs font-bold font-sans">すべて</span>
                </button>
                {sidebarTypes.map((type) => (
                  <div key={type.label} className="group relative flex items-center">
                    <button
                      onClick={() => setTypeFilter(type.label)}
                      className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        typeFilter === type.label ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      <span className="text-sm">{type.icon}</span>
                      <span className="text-xs font-bold font-sans">{type.label}</span>
                    </button>
                    {sidebarTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteType(type.label);
                        }}
                        className="absolute right-1 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        aria-label={`${type.label}を削除`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ステータスフィルター */}
            <div className="space-y-1 pt-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">ステータス</div>
              {[
                { label: 'すべて',    value: 'all',         dot: null },
                { label: '準備中',   value: 'in_progress',  dot: '#f59e0b' },
                { label: '入荷待ち', value: 'waiting',       dot: '#3b82f6' },
                { label: '準備完了', value: 'ready',         dot: '#10b981' },
                { label: '終了',     value: 'completed',    dot: '#94a3b8' },
              ].map(({ label, value, dot }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    statusFilter === value
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-slate-600 hover:text-amber-500'
                  }`}
                >
                  {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusFilter === value ? 'white' : dot }} />}
                  {label}
                </button>
              ))}
            </div>

            {/* STAFF Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-700">スタッフ</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STAFF</span>
                  {canEditEvent && (
                    <button
                      onClick={handleAddStaff}
                      className="p-1 hover:bg-indigo-50 rounded text-indigo-400 hover:text-indigo-600 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                {staffList.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">スタッフ未登録</p>
                )}
                {[...staffList]
                  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
                  .slice(0, staffExpanded ? undefined : STAFF_SHOW_COUNT)
                  .map((staff) => (
                  <div key={staff.id} className="group relative flex items-center">
                    <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 min-w-0">
                      <span className="text-sm shrink-0">👤</span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold font-sans">{staff.name}</span>
                        {staff.email && (
                          <span className="text-[10px] text-slate-400 truncate">{staff.email}</span>
                        )}
                      </div>
                    </div>
                    {canEditEvent && (
                      <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleEditStaffEmail(staff)}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                          aria-label={`${staff.name}のGmailアドレスを設定`}
                        >
                          <Mail size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff)}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          aria-label={`${staff.name}を削除`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {staffList.length > STAFF_SHOW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setStaffExpanded(prev => !prev)}
                    className="mx-3 mt-1 py-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors text-left"
                  >
                    {staffExpanded
                      ? '▲ 閉じる'
                      : `▼ もっと見る（あと${staffList.length - STAFF_SHOW_COUNT}人）`}
                  </button>
                )}
              </div>
            </div>

          </div>
        </aside>}

        {/* Main Content */}
        <main className="flex-1 bg-white relative overflow-hidden flex flex-col">
          <div className="p-4 lg:p-8 pb-20 lg:pb-8 flex-1 overflow-y-auto">
          {/* Sync / Error Indicator */}
          <AnimatePresence>
            {isSaving && (
              <motion.div 
                key="sync"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[100] flex items-center gap-3 bg-zinc-900 dark:bg-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 pointer-events-none"
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
            {saveError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                role="alert"
                onClick={() => setSaveError(null)}
                className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[100] flex items-start gap-3 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl max-w-sm cursor-pointer"
              >
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <div className="flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">保存エラー</div>
                  <div className="text-xs font-bold leading-snug">{saveError}</div>
                  <div className="text-[10px] opacity-70 mt-1">タップで閉じる</div>
                </div>
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
              {/* Desktop: Calendar grid / Mobile: Timeline list */}
              {view === "calendar" && (
                <>
                  <div className="hidden lg:block">
                    <CalendarView
                      events={desktopCalendarEvents}
                      year={calYear} month={calMonth}
                      setYear={setCalYear} setMonth={setCalMonth}
                      onSelect={handleEventSelect}
                      onHover={handleEventHover}
                      onHoverEnd={handleEventHoverEnd}
                      onCreateEvent={handleCreateEvent}
                      onOpenDayDetail={handleOpenDayDetail}
                      narrowViewport={narrowViewport}
                      densityPreview={calendarDensityPreview}
                      prepProgressMap={prepProgressMap}
                    />
                    {/* Dashboard + 在庫管理アプリ導線 */}
                    <Dashboard events={allEvents} />
                    <InventoryAppBanner />
                  </div>
                  <div className="lg:hidden space-y-3">
                    <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="カレンダー表示の切替">
                      {(
                        [
                          ["list", "一覧"],
                          ["day", "日"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={calendarMobileLayout === id}
                          onClick={() => {
                            setCalendarMobileLayout(id);
                            if (id === "day") {
                              const t = new Date();
                              if (t.getFullYear() === calYear && t.getMonth() + 1 === calMonth) {
                                setMobileAgendaDay(t.getDate());
                              }
                            }
                          }}
                          className={`min-h-9 flex-1 rounded-lg text-xs font-black transition-colors ${
                            calendarMobileLayout === id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {calendarMobileLayout === "list" && (
                      <>
                        <MobileWeekStrip events={filtered} />
                        <div className="mt-4">
                          {filtered.length === 0 ? <EmptyState /> : <MobileTimelineView events={filtered} onSelect={handleEventSelect} />}
                        </div>
                      </>
                    )}
                    {calendarMobileLayout === "day" && (
                      <MobileDayAgendaView
                        year={calYear}
                        month={calMonth}
                        agendaDay={mobileAgendaDay}
                        setAgendaDay={setMobileAgendaDay}
                        events={desktopCalendarEvents}
                        onSelect={handleEventSelect}
                        onOpenDayDetail={handleOpenDayDetail}
                        onCreateEvent={handleCreateEvent}
                        canEdit={canEditEvent}
                      />
                    )}
                  </div>
                  {/* モバイル: Dashboard + 在庫管理アプリ導線 */}
                  <div className="lg:hidden">
                    <Dashboard events={allEvents} />
                    <InventoryAppBanner />
                  </div>
                </>
              )}
              {(view === "prep" || view === "archive") && prepEvent ? (
                <PreparationList
                  event={prepEvent}
                  onBack={() => setPrepEvent(null)}
                  canEdit={canEditPreparationList}
                />
              ) : view === "prep" ? (() => {
                const today = new Date().toISOString().slice(0, 10);
                const activeEvents = [...allEvents]
                  .filter(ev => ev.end >= today)
                  .sort((a, b) => a.start.localeCompare(b.start));
                // 月ごとにグループ化
                const monthGroups: { month: string; events: Event[] }[] = [];
                for (const ev of activeEvents) {
                  const [y, m] = ev.start.split('-');
                  const key = `${y}-${m}`;
                  const label = `${parseInt(y)}年${parseInt(m)}月`;
                  const last = monthGroups[monthGroups.length - 1];
                  if (last?.month === label) last.events.push(ev);
                  else monthGroups.push({ month: label, events: [ev] });
                }
                return (
                  <div className="flex flex-col h-full overflow-y-auto pb-20 bg-slate-50">
                    <div className="px-4 py-4">
                      <h2 className="text-base font-black text-slate-800 mb-4">準備物リスト</h2>
                      {activeEvents.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">進行中のイベントがありません</div>
                      ) : (
                        <div className="flex flex-col gap-5">
                          {monthGroups.map(({ month, events: evs }) => (
                            <div key={month}>
                              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">{month}</div>
                              <div className="flex flex-col gap-2">
                                {evs.map(ev => {
                                  const s = fmtDateJP(ev.start);
                                  const until = daysUntil(ev.start);
                                  const isToday = until === 0;
                                  const isSoon = until > 0 && until <= 7;
                                  const isOngoing = until < 0 && ev.end >= today;
                                  const urgencyBadge = isToday
                                    ? { label: '今日', cls: 'bg-red-500 text-white' }
                                    : isOngoing
                                    ? { label: '開催中', cls: 'bg-emerald-500 text-white' }
                                    : isSoon
                                    ? { label: `${until}日後`, cls: 'bg-amber-400 text-white' }
                                    : null;
                                  return (
                                    <button
                                      key={ev.id}
                                      onClick={() => setPrepEvent(ev)}
                                      className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm flex items-stretch overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all"
                                    >
                                      {/* 日付バッジ */}
                                      <div className={`flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0 ${isToday ? 'bg-red-500' : isOngoing ? 'bg-emerald-500' : isSoon ? 'bg-amber-400' : 'bg-indigo-600'}`}>
                                        <span className="text-[10px] font-black text-white/70 leading-none">{s.month}月</span>
                                        <span className="text-xl font-black text-white leading-none mt-0.5">{s.day}</span>
                                        <span className="text-[10px] font-black text-white/80 leading-none mt-0.5">{s.dow}</span>
                                      </div>
                                      {/* コンテンツ */}
                                      <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="font-bold text-slate-800 text-sm truncate">{ev.venue}</span>
                                          {urgencyBadge && (
                                            <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${urgencyBadge.cls}`}>{urgencyBadge.label}</span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-400 truncate">{fmtDateRange(ev.start, ev.end)}</div>
                                      </div>
                                      <div className="flex items-center pr-3">
                                        <ChevronRight size={16} className="text-slate-300 shrink-0" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : view === "archive" ? (() => {
                const today = new Date().toISOString().slice(0, 10);
                const archivedEvents = [...allEvents]
                  .filter(ev => ev.end < today)
                  .sort((a, b) => b.end.localeCompare(a.end));
                const monthGroups: { month: string; events: Event[] }[] = [];
                for (const ev of archivedEvents) {
                  const [y, m] = ev.start.split('-');
                  const label = `${parseInt(y)}年${parseInt(m)}月`;
                  const last = monthGroups[monthGroups.length - 1];
                  if (last?.month === label) last.events.push(ev);
                  else monthGroups.push({ month: label, events: [ev] });
                }
                return (
                  <div className="flex flex-col h-full overflow-y-auto pb-20 bg-slate-50">
                    <div className="px-4 py-4">
                      <h2 className="text-base font-black text-slate-800 mb-1">アーカイブ</h2>
                      <p className="text-xs text-slate-400 mb-4">終了したイベントの準備物を確認できます</p>
                      {archivedEvents.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">アーカイブされたイベントがありません</div>
                      ) : (
                        <div className="flex flex-col gap-5">
                          {monthGroups.map(({ month, events: evs }) => (
                            <div key={month}>
                              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">{month}</div>
                              <div className="flex flex-col gap-2">
                                {evs.map(ev => {
                                  const s = fmtDateJP(ev.start);
                                  return (
                                    <button
                                      key={ev.id}
                                      onClick={() => setPrepEvent(ev)}
                                      className="w-full text-left bg-white/60 rounded-2xl border border-slate-100 shadow-sm flex items-stretch overflow-hidden hover:border-slate-300 hover:shadow-md transition-all opacity-80 hover:opacity-100"
                                    >
                                      {/* 日付バッジ（グレー） */}
                                      <div className="flex flex-col items-center justify-center px-3 py-3 min-w-[52px] shrink-0 bg-slate-200">
                                        <span className="text-[10px] font-black text-slate-500 leading-none">{s.month}月</span>
                                        <span className="text-xl font-black text-slate-500 leading-none mt-0.5">{s.day}</span>
                                        <span className="text-[10px] font-black text-slate-400 leading-none mt-0.5">{s.dow}</span>
                                      </div>
                                      {/* コンテンツ */}
                                      <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                                        <div className="font-bold text-slate-600 text-sm truncate mb-0.5">{ev.venue}</div>
                                        <div className="text-xs text-slate-400 truncate">{fmtDateRange(ev.start, ev.end)}</div>
                                      </div>
                                      <div className="flex items-center pr-3">
                                        <ChevronRight size={16} className="text-slate-300 shrink-0" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : null}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {dayDetail && (
          <div key="day-detail" className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDayDetail}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              onPointerDown={(e) => e.stopPropagation()}
              className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border border-gray-100 bg-white shadow-2xl max-lg:max-h-[92dvh] max-lg:rounded-b-none max-lg:border-b-0 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:max-w-md lg:rounded-3xl w-full"
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 lg:hidden" aria-hidden />
              <div className="p-5 lg:p-6 border-b border-slate-100 flex justify-between items-start gap-3 shrink-0">
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    {dayDetail.year}年{dayDetail.month}月{dayDetail.day}日
                  </h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">この日のイベント {dayDetail.events.length} 件</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDayDetail}
                  className="w-9 h-9 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="閉じる"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 lg:p-5 space-y-2 flex-1 min-h-0">
                {dayDetail.events.map((ev) => {
                  const typeSty = ts(ev.type || "");
                  const optionalLine = buildEventOptionalCaption(ev);
                  return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handlePickEventFromDayDetail(ev)}
                    title={ev.status === 'completed' ? '完了済み' : undefined}
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: typeSty.border,
                    }}
                    className="flex min-h-11 w-full items-center text-left rounded-xl border border-solid border-slate-200 bg-white px-3 py-2 shadow-sm ring-1 ring-inset ring-slate-900/[0.04] overflow-hidden transition hover:border-slate-300 hover:bg-slate-50/80"
                  >
                    <div className="flex min-h-0 w-full items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full border border-slate-900/15"
                        style={{ backgroundColor: typeSty.border }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="font-bold text-sm text-slate-900 truncate block">{ev.venue}</span>
                        {optionalLine ? (
                          <span className="text-[11px] font-medium text-slate-600 truncate block mt-0.5">{optionalLine}</span>
                        ) : null}
                      </span>
                    </div>
                  </button>
                );
                })}
              </div>
            </motion.div>
          </div>
        )}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col border border-gray-100 w-full lg:w-[520px] lg:max-w-[520px] max-h-[92vh] lg:max-h-[90vh]"
            >
                {selected.status === 'completed' && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-orange-500 border-b border-orange-600">
                    <span className="text-white">⚑</span>
                    <span className="text-xs font-bold text-white">このイベントは終了しました</span>
                  </div>
                )}
                <div className="p-6 lg:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto overflow-x-hidden">
                  {/* Header: タグ + 閉じるボタン */}
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        {REGIONS.map(r => (
                          <button
                            key={r}
                            type="button"
                            disabled={!canEditEvent}
                            onClick={() => canEditEvent && handleUpdateEvent(selected.id, { region: r, dept: '' })}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                              selected.region === r
                                ? 'text-white border-transparent'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            } ${!canEditEvent ? 'cursor-default' : 'cursor-pointer'}`}
                            style={selected.region === r
                              ? { background: rs(r).dot, borderColor: rs(r).dot }
                              : {}
                            }
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sidebarTypes.map(t => (
                          <button
                            key={t.label}
                            type="button"
                            disabled={!canEditEvent}
                            onClick={() => canEditEvent && handleUpdateEvent(selected.id, { type: t.label })}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                              selected.type === t.label
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                            } ${!canEditEvent ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <span>{t.icon}</span><span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="h-px bg-gray-100 mb-4"></div>

                  {/* タブ切替 */}
                  <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
                    {(
                      [
                        { id: 'detail', label: '詳細' },
                        { id: 'photos', label: `写真${selected.photos?.length ? ` (${selected.photos.length})` : ''}` },
                      ] as { id: ModalTab; label: string }[]
                    ).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setModalTab(t.id)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${modalTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* 写真タブ */}
                  {modalTab === 'photos' && (
                    <div className="space-y-4">
                      {canUploadPhoto && (selected.photos?.length ?? 0) < MAX_PHOTOS && (
                        <PhotoUpload
                          onUpload={async (file) => {
                            const newPhoto = await uploadPhoto(file);
                            // hasUnsavedChanges=true のとき onSnapshot が selected を更新しないため手動反映
                            // false のときは onSnapshot が自動更新するので手動更新すると二重になる
                            if (newPhoto && hasUnsavedChanges) {
                              setSelected(prev => prev ? { ...prev, photos: [...(prev.photos ?? []), newPhoto] } : prev);
                            }
                          }}
                          uploading={photoUploading}
                          uploadProgress={photoUploading ? uploadProgress : 0}
                          currentCount={selected.photos?.length ?? 0}
                          maxPhotos={MAX_PHOTOS}
                        />
                      )}
                      {canUploadPhoto && (selected.photos?.length ?? 0) >= MAX_PHOTOS && (
                        <p className="text-xs text-center text-slate-400 py-2">写真は最大{MAX_PHOTOS}枚までです</p>
                      )}
                      {photoError && <p className="text-xs text-red-500 font-bold">{photoError}</p>}
                      <PhotoGallery
                        photos={selected.photos || []}
                        onDelete={async (photo) => {
                          await deleteEventPhoto(photo);
                          setSelected(prev => prev ? {
                            ...prev,
                            photos: (prev.photos ?? []).filter(p => p.id !== photo.id)
                          } : prev);
                        }}
                        onUpdateCaption={async (photo, caption) => {
                          await updatePhotoCaption(photo, caption);
                          setSelected(prev => prev ? {
                            ...prev,
                            photos: (prev.photos ?? []).map(p => p.id === photo.id ? { ...p, caption } : p)
                          } : prev);
                        }}
                        canEdit={canUploadPhoto}
                      />
                    </div>
                  )}

                  {/* フィールド */}
                  {modalTab === 'detail' && <><div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">VENUE・会場</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                        value={selected.venue}
                        placeholder="会場を入力..."
                        disabled={!canEditEvent}
                        onChange={e => handleUpdateEvent(selected.id, { venue: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">START</label>
                        <input
                          type="date"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                          value={selected.start}
                          disabled={!canEditEvent}
                          onChange={e => handleUpdateEvent(selected.id, { start: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">END</label>
                        <input
                          type="date"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                          value={selected.end}
                          disabled={!canEditEvent}
                          onChange={e => handleUpdateEvent(selected.id, { end: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">CLIENT・クライアント</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                        value={selected.client}
                        placeholder="クライアント名を入力..."
                        disabled={!canEditEvent}
                        onChange={e => handleUpdateEvent(selected.id, { client: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">メモ</label>
                      <textarea
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[88px] resize-none read-only:bg-gray-50 read-only:text-gray-500"
                        value={selected.detailMemo ?? ''}
                        placeholder="例：搬入は西口ローリング床／15:00までに主電源・Wi-Fi確認"
                        readOnly={!canEditEvent}
                        onChange={e => {
                          const detailMemo = e.target.value;
                          handleUpdateEvent(selected.id, {
                            detailMemo,
                            detailMemoAttribution: buildFieldAttribution(user) ?? selected.detailMemoAttribution,
                          });
                        }}
                      />
                      {formatAttributionLine(selected.detailMemoAttribution) ? (
                        <p className="mt-1.5 text-[11px] text-gray-500">{formatAttributionLine(selected.detailMemoAttribution)}</p>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">担当者</label>
                      {staffList.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">サイドバーのスタッフ欄からメンバーを追加してください。</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {staffList.map(staff => {
                            const isAssigned = (selected.assignees ?? []).includes(staff.name);
                            return (
                              <button
                                key={staff.id}
                                type="button"
                                disabled={!canEditEvent}
                                onClick={() => {
                                  const current = selected.assignees ?? [];
                                  const next = isAssigned
                                    ? current.filter(n => n !== staff.name)
                                    : [...current, staff.name];
                                  handleUpdateEvent(selected.id, { assignees: next });
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                  isAssigned
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                              >
                                {staff.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 日別役割 */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">日別役割</label>
                      {(selected.assignees ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">担当者を選択すると日別に役割を設定できます。</p>
                      ) : (
                        <div className="space-y-3">
                          {getDaysInRange(selected.start, selected.end).map(date => (
                            <div key={date} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                              <div className="text-[11px] font-bold text-gray-500 mb-2">{formatDayLabel(date)}</div>
                              <div className="space-y-2">
                                {(selected.assignees ?? []).map(memberName => (
                                  <div key={memberName} className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-700 w-20 shrink-0 truncate">{memberName}</span>
                                    <input
                                      type="text"
                                      value={localDailyRoles?.[date]?.[memberName] ?? ''}
                                      disabled={!canEditEvent}
                                      placeholder="役割を入力"
                                      onChange={e => {
                                        const val = e.target.value;
                                        setLocalDailyRoles(prev => ({
                                          ...prev,
                                          [date]: { ...(prev[date] ?? {}), [memberName]: val },
                                        }));
                                        hasUnsavedChangesRef.current = true;
                                        setHasUnsavedChanges(true);
                                      }}
                                      className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ステータス */}
                    {canEditEvent && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ステータス</label>
                        <div className="flex flex-wrap gap-2">
                          {(['scheduled','in_progress','waiting','ready','completed','cancelled'] as const).map(s => {
                            const sty = statusStyle(s);
                            const isActive = (selected?.status ?? 'scheduled') === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleUpdateEvent(selected.id, { status: s })}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                                  isActive
                                    ? `${sty.bg} ${sty.text} border-current`
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: sty.dot }} />}
                                {sty.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                    {hasUnsavedChanges && (
                      <button
                        onClick={handleSaveEvent}
                        disabled={isSaving}
                        className="flex-1 py-4 rounded-2xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-lg shadow-amber-500/20"
                      >
                        <Save size={16} />
                        {isSaving ? "保存中..." : "保存する"}
                      </button>
                    )}
                    <button
                      onClick={() => { if (selected) { setPrepEvent(selected); setView('prep'); setSelected(null); } }}
                      className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                    >
                      <ClipboardList size={18} />
                      準備物リストを開く
                    </button>
                  </div>
                  {isEventEditor(user?.email) && (
                    <>
                      <button
                        onClick={handleNotifyEmail}
                        disabled={isNotifying}
                        className="w-full mt-2 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                      >
                        <Send size={15} />
                        {isNotifying ? '送信中...' : 'メンバーに通知する'}
                      </button>
                      {notifyResult && (
                        <p className="text-xs text-center text-slate-500 mt-1">{notifyResult}</p>
                      )}
                    </>
                  )}
                  {canEditEvent && (
                    <button
                      onClick={handleDeleteEvent}
                      className="w-full mt-2 py-3 rounded-2xl border border-red-200 text-sm font-bold text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      このイベントを削除
                    </button>
                  )}

                  <AnimatePresence>
                    {validationErrors.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl"
                      >
                        {validationErrors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600 font-bold">
                            ⚠️ {err.message}
                          </p>
                        ))}
                      </motion.div>
                    )}
                    {hasUnsavedChanges && validationErrors.length === 0 && (
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
                  </>}
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hover Preview Card（PC only） */}
      {hoveredEvent && (
        <HoverCard event={hoveredEvent} pos={hoverPos} prepStats={prepProgressMap[hoveredEvent.id]} />
      )}

      {/* モバイル FAB — 新規イベント作成 */}
      {canEditEvent && view === 'calendar' && (
        <button
          type="button"
          onClick={() => handleCreateEvent()}
          className="fixed bottom-[4.5rem] right-4 z-30 lg:hidden w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full shadow-xl shadow-indigo-500/40 flex items-center justify-center transition-all"
          aria-label="新規イベントを作成"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around pb-safe z-20 lg:hidden">
        {(
          [
            { id: "calendar", icon: <Calendar size={22} />,     label: "カレンダー" },
            { id: "prep",     icon: <ClipboardList size={22} />, label: "準備物" },
            { id: "archive",  icon: <Archive size={22} />,       label: "アーカイブ" },
          ] as { id: ViewMode; icon: React.ReactNode; label: string }[]
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => { if (tab.id !== 'prep' && tab.id !== 'archive') setPrepEvent(null); setView(tab.id); }}
            className={`flex flex-col items-center gap-0.5 px-4 py-3 text-[10px] font-bold transition-colors ${
              view === tab.id ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════
   サブコンポーネント
═══════════════════════════════════════ */

interface MobileTimelineViewProps {
  events: Event[];
  onSelect: (event: Event) => void;
}

function MobileTimelineView({ events, onSelect }: MobileTimelineViewProps) {
  const fmtGroup = (d: string) => {
    if (!d) return "—";
    const [, m, day] = d.split("-");
    const date = new Date(d);
    const dow = ["日","月","火","水","木","金","土"][date.getDay()];
    return `${parseInt(m)}/${parseInt(day)} ${dow}`;
  };

  const grouped = useMemo(() => {
    const map: Record<string, Event[]> = {};
    events.forEach((ev) => {
      const key = ev.start || "未定";
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1);
  }, [events]);

  return (
    <div className="space-y-6 pb-2">
      {grouped.map(([date, evs]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-black text-slate-700">{fmtGroup(date)}</span>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs font-bold text-slate-400">{evs.length}</span>
          </div>
          <div className="space-y-2">
            {evs.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onSelect(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                className="w-full bg-white border border-slate-100 rounded-2xl flex items-center gap-3 text-left shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="w-1 self-stretch rounded-l-2xl shrink-0" style={{ background: rs(ev.region || "").dot }} />
                <span className="text-xl py-4 shrink-0">{ev.emoji || ts(ev.type || "").icon}</span>
                <div className="flex-1 py-4 min-w-0">
                  <div className="font-bold text-slate-800 text-sm truncate">{ev.venue}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {ev.region}・{ev.type || "その他"}
                  </div>
                </div>
                {ev.end && ev.end !== ev.start && (
                  <span className="text-[11px] text-slate-400 font-bold pr-4 shrink-0">→{fmtShort(ev.end)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface MobileWeekStripProps {
  events: Event[];
}

function MobileWeekStrip({ events }: MobileWeekStripProps) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="flex justify-between px-1 mb-2">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        const hasEvent = events.some((ev) => ev.start && new Date(ev.start).toDateString() === d.toDateString());
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={`text-[10px] font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>{dayLabels[i]}</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
              isToday ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-slate-600"
            }`}>
              {d.getDate()}
            </div>
            {hasEvent && !isToday && <div className="w-1 h-1 rounded-full bg-indigo-400" />}
            {!hasEvent && <div className="w-1 h-1" />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 月カレンダー「1日セル」内に並べるイベント行の上限。
 * この件数を超える分はセルに描画せず、hiddenCount として「+N件」に集約し、
 * 日別一覧（モーダル）へ誘導する。表示密度を変えたいときはこの定数だけ調整すればよい。
 */
const MAX_EVENTS_IN_DAY_CELL = 3;

/**
 * 狭いビューポート（CSS: max-width 768px）の月グリッド日セルに並べる上限。
 * タッチ操作向けに +N へ早めに集約する。
 */
const MAX_EVENTS_IN_DAY_CELL_NARROW = 2;

/**
 * 日セル内「イベント列」ブロックの最大高さ（CSS 長さ）。
 * この領域は overflow:hidden（スクロール不可）。超過分は件数上限・+N 集約で表現し、
 * 高さと件数の両方でオーバーフローしないよう保つ。
 */
const CAL_DAY_CELL_EVENTS_MAX_HEIGHT = "5.875rem";

/** 狭いビューポート用（行高 36px 前後×最大2件 + +N 行） */
const CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW = "8.125rem";

/**
 * イベント1行相当の最小高さ（イベントチップと「+N件」行の揃え用）。
 * CAL_DAY_CELL_EVENTS_MAX_HEIGHT と MAX_EVENTS_IN_DAY_CELL を変えるときは併せて見直す。
 */
const CAL_DAY_CELL_EVENT_ROW_MIN_HEIGHT = "1.375rem";

/** タップ領域の下限（誤タップ低減）。狭いビューポートの月グリッドで使用 */
const CAL_EVENT_ROW_MIN_HEIGHT_TOUCH = "36px";

/** モバイル「週」: 月グリッド上の1週分（常に最大 MAX_EVENTS_IN_DAY_CELL_NARROW 件 + +N） */
interface MobileMonthWeekGridProps {
  year: number;
  month: number;
  weekRowIndex: number;
  onWeekRowChange: (idx: number) => void;
  events: Event[];
  onSelect: (ev: Event) => void;
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  onCreateEvent: (data?: Partial<Event>) => void;
}

function MobileMonthWeekGrid({
  year,
  month,
  weekRowIndex,
  onWeekRowChange,
  events,
  onSelect,
  onOpenDayDetail,
  onCreateEvent,
}: MobileMonthWeekGridProps) {
  const cells = buildMonthGridCells(year, month);
  const weekRowCount = cells.length / 7;
  const weekSlice = cells.slice(weekRowIndex * 7, weekRowIndex * 7 + 7);
  const today = new Date();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40"
          disabled={weekRowIndex <= 0}
          onClick={() => onWeekRowChange(Math.max(0, weekRowIndex - 1))}
          aria-label="前の週"
        >
          ‹
        </button>
        <span className="text-center text-xs font-black text-slate-700">
          {year}年{month}月 · 第{weekRowIndex + 1}/{weekRowCount}週
        </span>
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40"
          disabled={weekRowIndex >= weekRowCount - 1}
          onClick={() => onWeekRowChange(Math.min(weekRowCount - 1, weekRowIndex + 1))}
          aria-label="次の週"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekSlice.map((cell, i) => {
          const idx = weekRowIndex * 7 + i;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;
          const isToday =
            cell.current &&
            today.getFullYear() === year &&
            today.getMonth() === month - 1 &&
            today.getDate() === cell.day;
          const dayEvents = cell.current ? events.filter((ev) => eventCoversDate(ev, year, month, cell.day)) : [];
          const maxN = MAX_EVENTS_IN_DAY_CELL_NARROW;
          const visible = dayEvents.slice(0, maxN);
          const hiddenCount = Math.max(0, dayEvents.length - maxN);
          return (
            <div
              key={`${year}-${month}-${idx}`}
              className={`flex min-h-[8.5rem] flex-col rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm ${
                isToday ? "ring-2 ring-indigo-400/40" : ""
              }`}
            >
              <div
                className={`mb-0.5 shrink-0 border-b border-slate-100 pb-0.5 text-center ${
                  !cell.current ? "text-slate-300" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-slate-600"
                }`}
              >
                <div className="text-[9px] font-bold text-slate-400">{DAYS_JP[idx % 7]}</div>
                <div
                  className={`text-[13px] font-bold tabular-nums ${
                    cell.current && isToday ? "rounded-md bg-indigo-600 px-1 py-0.5 text-white" : ""
                  }`}
                >
                  {cell.day}
                </div>
              </div>
              <div
                className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden"
                style={{ maxHeight: CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW }}
              >
                {visible.map((ev) => {
                  const typeSty = ts(ev.type || "");
                  const captionNd = buildEventOptionalCaption(ev, { includeDates: false });
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelect(ev)}
                      title={ev.status === 'completed' ? '完了済み' : undefined}
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: typeSty.border,
                        minHeight: CAL_EVENT_ROW_MIN_HEIGHT_TOUCH,
                      }}
                      aria-label={captionNd ? `${ev.venue}。${captionNd}` : ev.venue}
                      className="flex w-full shrink-0 flex-col justify-center overflow-hidden rounded border border-slate-200 bg-white px-1 py-0.5 text-left ring-1 ring-inset ring-slate-900/[0.04]"
                    >
                      <span className="w-full truncate text-[11px] font-bold leading-tight text-slate-900">
                        {ev.venue}
                      </span>
                      <span className="w-full truncate text-[9px] leading-tight text-slate-400">
                        {ev.region}{ev.type ? `・${ev.type}` : ''}
                      </span>
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    style={{ minHeight: CAL_EVENT_ROW_MIN_HEIGHT_TOUCH }}
                    onClick={() => onOpenDayDetail({ year, month, day: cell.day, events: dayEvents })}
                    className="w-full shrink-0 rounded border border-slate-300 bg-slate-200 py-1 text-center text-[10px] font-bold text-slate-800 shadow-sm"
                  >
                    +{hiddenCount}
                  </button>
                )}
                {cell.current && dayEvents.length === 0 && (
                  <button
                    type="button"
                    className="mt-auto flex min-h-9 flex-1 items-center justify-center rounded border border-dashed border-slate-200 text-slate-300"
                    onClick={() =>
                      onCreateEvent({
                        start: `${year}-${String(month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`,
                      })
                    }
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

interface MobileDayAgendaViewProps {
  year: number;
  month: number;
  agendaDay: number;
  setAgendaDay: (d: number) => void;
  events: Event[];
  onSelect: (ev: Event) => void;
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  onCreateEvent: (data?: Partial<Event>) => void;
  canEdit: boolean;
}

function MobileDayAgendaView({
  year,
  month,
  agendaDay,
  setAgendaDay,
  events,
  onSelect,
  onOpenDayDetail,
  onCreateEvent,
  canEdit,
}: MobileDayAgendaViewProps) {
  const dim = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(1, agendaDay), dim);
  const dayEvents = events.filter((ev) => eventCoversDate(ev, year, month, day));
  const dow = DAYS_JP[new Date(year, month - 1, day).getDay()];
  const maxN = MAX_EVENTS_IN_DAY_CELL_NARROW;
  const visible = dayEvents.slice(0, maxN);
  const hiddenCount = Math.max(0, dayEvents.length - maxN);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40"
          disabled={day <= 1}
          onClick={() => setAgendaDay(day - 1)}
          aria-label="前の日"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-lg font-black text-slate-800 tabular-nums">
            {year}/{month}/{day}
          </div>
          <div className="text-xs font-bold text-slate-500">{dow}曜日</div>
        </div>
        <button
          type="button"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-600 disabled:opacity-40"
          disabled={day >= dim}
          onClick={() => setAgendaDay(day + 1)}
          aria-label="次の日"
        >
          ›
        </button>
      </div>

      {dayEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400">
          この日のイベントはありません
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((ev) => {
            const typeSty = ts(ev.type || "");
            const meta = buildEventOptionalCaption(ev);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev)}
                title={ev.status === 'completed' ? '完了済み' : undefined}
                style={{ borderLeftWidth: 3, borderLeftColor: typeSty.border }}
                className="flex min-h-11 w-full items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm ring-1 ring-inset ring-slate-900/[0.04]"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-slate-900/15"
                  style={{ backgroundColor: typeSty.border }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900">{ev.venue}</span>
                  {meta ? (
                    <span className="mt-0.5 block truncate text-xs font-medium text-slate-600">{meta}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenDayDetail({ year, month, day, events: dayEvents })}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-sm font-bold text-slate-800 shadow-sm"
            >
              ほか +{hiddenCount}件
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <button
          type="button"
          disabled={!canEdit}
          className={`flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed text-sm font-bold transition-colors ${
            canEdit
              ? 'border-indigo-200 bg-indigo-50/50 text-indigo-700'
              : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          }`}
          onClick={() =>
            canEdit &&
            onCreateEvent({
              start: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            })
          }
        >
          この日にイベントを追加
        </button>
        {!canEdit && (
          <p className="text-center text-[11px] text-slate-400">
            ※ 権限がありません
          </p>
        )}
      </div>
    </div>
  );
}

interface CalendarViewProps {
  events: Event[];
  year: number;
  month: number;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  onSelect: (event: Event) => void;
  onHover: (event: Event, e: ReactMouseEvent<HTMLElement>) => void;
  onHoverEnd: () => void;
  onCreateEvent: (data?: Partial<Event>) => void;
  /** 「+N件」押下時: その日の全イベントを渡して詳細導線（モーダル等）を開く */
  onOpenDayDetail: (ctx: { year: number; month: number; day: number; events: Event[] }) => void;
  narrowViewport: boolean;
  densityPreview?: boolean;
  prepProgressMap?: Record<string, { total: number; done: number }>;
}

function CalendarView({ events, year, month, setYear, setMonth, onSelect, onHover, onHoverEnd, onCreateEvent, onOpenDayDetail, narrowViewport, densityPreview, prepProgressMap = {} }: CalendarViewProps) {
  const cells = buildMonthGridCells(year, month);

  const maxEventsInCell = narrowViewport ? MAX_EVENTS_IN_DAY_CELL_NARROW : MAX_EVENTS_IN_DAY_CELL;
  const eventRowMinHeight = narrowViewport ? CAL_EVENT_ROW_MIN_HEIGHT_TOUCH : CAL_DAY_CELL_EVENT_ROW_MIN_HEIGHT;
  const eventsPanelMaxHeight = narrowViewport ? CAL_DAY_CELL_EVENTS_MAX_HEIGHT_NARROW : CAL_DAY_CELL_EVENTS_MAX_HEIGHT;

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const setToday = () => { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); };

  const today = new Date();
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekRows = cells.length / 7;
  const isSixWeekMonth = weekRows >= 6;

  return (
    <div className="flex flex-col h-full">
      {densityPreview && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold leading-snug text-amber-900">
          開発プレビュー: URL に <code className="rounded bg-white/80 px-1">?calPreview=density</code> を付けた状態です。月内の同一週に「0件 / 2件 / 4件 / 6件」のサンプル行が並びます（狭い画面では最大{MAX_EVENTS_IN_DAY_CELL_NARROW}件、それ以外は最大{MAX_EVENTS_IN_DAY_CELL}件まで表示し、残りは「+N件」から一覧を開けます。リロードで解除）。
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {monthNames[month]} <span className="text-slate-400 font-bold ml-1">{year}</span>
          </h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft size={20} /></button>
            <button onClick={setToday} className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm ml-1 mr-1">今日</button>
            <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      <div
        className="flex-1 grid min-h-0 grid-cols-7 border-t border-l border-slate-100"
        style={{
          gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))`,
        }}
      >
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
          <div key={d} className="border-r border-b border-slate-100 bg-slate-50/10 py-2 px-3">
            <span className={`text-[9px] font-black uppercase tracking-widest ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{d}</span>
          </div>
        ))}
        
        {cells.map((cell, idx) => {
          const isSun = idx % 7 === 0;
          const isSatCal = idx % 7 === 6;
          const isToday = cell.current && today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === cell.day;
          const dayEvents = cell.current ? events.filter((ev) => eventCoversDate(ev, year, month, cell.day)) : [];
          const visibleEvents = dayEvents.slice(0, maxEventsInCell);
          const hiddenCount = Math.max(0, dayEvents.length - maxEventsInCell);

          return (
            <div
              key={idx}
              className={`
                group relative flex h-full min-h-0 flex-col overflow-hidden border-r border-b border-slate-100 px-1 pb-1.5 pt-1.5
                ${cell.current ? "bg-white" : "bg-slate-50/20"}
                ${isSixWeekMonth
                  ? "min-h-[104px] sm:min-h-[112px] md:min-h-[118px] lg:min-h-[122px] xl:min-h-[128px] 2xl:min-h-[136px]"
                  : "min-h-[128px] sm:min-h-[136px] md:min-h-[144px] lg:min-h-[152px] xl:min-h-[160px]"}
              `}
            >
              {/* 今日・祝日・選択日などの装飾は背景レイヤに分離（テキスト／イベント領域の高さを圧迫しない）。祝日・選択日の色帯も同 div 内に載せる */}
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                {cell.current && isToday && (
                  <div className="absolute inset-0 bg-indigo-50/50 ring-1 ring-inset ring-indigo-100/80" />
                )}
              </div>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex h-7 shrink-0 items-center border-b border-slate-100/90 px-0.5">
                  <span
                    className={`
                      inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md text-[13px] font-bold tabular-nums
                      ${!cell.current ? "text-slate-300" : isToday ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200/60" : isSun ? "text-red-500" : isSatCal ? "text-blue-500" : "text-slate-700"}
                    `}
                  >
                    {cell.day}
                  </span>
                  {cell.current && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                      className="ml-auto w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="イベントを追加"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>

                <div className="mt-1 flex min-h-0 flex-1 flex-col">
                  <div
                    className="flex min-h-0 flex-col gap-1 overflow-hidden"
                    style={{ maxHeight: eventsPanelMaxHeight }}
                  >
                    {visibleEvents.map((ev) => {
                      const typeSty = ts(ev.type || "");
                      const captionNoDates = buildEventOptionalCaption(ev, { includeDates: false });
                      const captionFull = buildEventOptionalCaption(ev);
                      return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelect(ev)}
                        onMouseEnter={(e) => onHover(ev, e)}
                        onMouseLeave={onHoverEnd}
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: typeSty.border,
                          minHeight: eventRowMinHeight,
                        }}
                        aria-label={
                          narrowViewport
                            ? (captionNoDates ? `${ev.venue}。${captionNoDates}` : ev.venue)
                            : (captionFull ? `${ev.venue}。${captionFull}` : ev.venue)
                        }
                        title={ev.status === 'completed' ? '完了済み' : undefined}
                        className="relative overflow-hidden flex w-full shrink-0 items-center gap-1.5 rounded-md border border-solid border-slate-200 bg-white px-1.5 py-0.5 text-left shadow-sm ring-1 ring-inset ring-slate-900/[0.04] transition hover:border-slate-300 hover:bg-slate-50/90"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full border border-slate-900/20"
                          style={{ backgroundColor: typeSty.border }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[12px] font-semibold leading-tight text-slate-900 max-xl:text-[11px]">
                          {ev.venue}
                        </span>
                        {/* 準備物進捗バー */}
                        {(() => {
                          const prog = prepProgressMap[ev.id];
                          if (!prog || prog.total === 0) return null;
                          const pct = Math.round((prog.done / prog.total) * 100);
                          return (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
                              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          );
                        })()}
                      </button>
                    );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDayDetail({
                            year,
                            month,
                            day: cell.day,
                            events: dayEvents,
                          })
                        }
                        style={{ minHeight: eventRowMinHeight }}
                        className="w-full shrink-0 text-left rounded-md border border-solid border-slate-300/80 bg-slate-200/90 px-1 py-0.5 flex items-center justify-center overflow-hidden transition hover:bg-slate-300/90 hover:border-slate-400/80 text-[12px] max-xl:text-[11px] leading-none font-bold text-slate-800 shadow-sm ring-1 ring-inset ring-slate-900/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1"
                        aria-label={`あと${hiddenCount}件のイベントを表示`}
                      >
                        +{hiddenCount}件
                      </button>
                    )}
                  </div>

                  {cell.current && dayEvents.length === 0 && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                      className={`mt-auto flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 py-1 opacity-0 transition-all hover:border-indigo-300 hover:text-indigo-400 group-hover:opacity-100 text-slate-300 ${
                        narrowViewport ? "min-h-9" : "min-h-[2rem]"
                      }`}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



function HoverCard({ event, pos, prepStats }: {
  event: Event;
  pos: { x: number; y: number };
  prepStats?: { total: number; done: number };
}) {
  const left = pos.x + 260 > window.innerWidth ? pos.x - 270 : pos.x + 16;
  const top = pos.y + 280 > window.innerHeight ? pos.y - 260 : pos.y + 8;
  const pct = prepStats && prepStats.total > 0 ? Math.round((prepStats.done / prepStats.total) * 100) : null;

  return (
    <div
      className="fixed z-[200] w-60 bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 pointer-events-none hidden lg:block"
      style={{ left, top }}
    >
      <div className="flex items-start gap-2 mb-3">
        <span
          className="mt-0.5 h-2 w-2 shrink-0 rounded-full border border-slate-900/15"
          style={{ backgroundColor: ts(event.type || "").border }}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="font-black text-sm text-slate-900 leading-tight truncate">{event.venue}</div>
          <div className="text-[10px] font-bold text-slate-600 mt-0.5">{buildEventOptionalCaption(event) || (event.type || "その他")}</div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-slate-700">
        <div className="flex gap-2">
          <span className="w-2 h-2 rounded-full mt-1 shrink-0 ring-1 ring-slate-900/10" style={{ background: rs(event.region || '').dot }} />
          <span>{event.region}</span>
        </div>
        <div className="font-mono text-slate-500">
          {event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ''}
        </div>
        {event.client && <div className="text-slate-500">{event.client}</div>}
        {event.note && <div className="text-slate-400 line-clamp-2">{event.note}</div>}
      </div>
      {prepStats && prepStats.total > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">準備物</span>
            <span className="text-[10px] font-black text-indigo-600">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-bold">
            {prepStats.done} / {prepStats.total} 完了
          </div>
        </div>
      )}
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

