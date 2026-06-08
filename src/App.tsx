import { useState, useMemo, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { db, auth, loginWithGoogle } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { DATA, REGION_STYLE, TYPE_STYLE, DAYS_JP, REGIONS } from './constants';
import { Event, PreparationItem, type FieldAuthorAttribution } from './types';
import { Calendar, List, Menu, X, ChevronLeft, ChevronRight, Building2, ClipboardList, Save, Plus, Search, Settings, LogOut, BarChart2, Camera, Trash2, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import PreparationList from './components/PreparationList';
import NotificationCenter from './components/notifications/NotificationCenter';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import PhotoUpload from './components/photos/PhotoUpload';
import PhotoGallery from './components/photos/PhotoGallery';
import { useAnalytics } from './hooks/useAnalytics';
import { usePhotos } from './hooks/usePhotos';
import {
  canEditEvent as computeCanEditEvent,
  canEditPreparationList as computeCanEditPreparationList,
} from './lib/permissions';
import { registerFcmToken } from './lib/fcm';
import { recordUserLogin, notifyEventCreated, notifyEventUpdated, notifyEventDeleted } from './lib/notifications';

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
const getMonth = (d: string) => { if (!d) return null; return parseInt(d.split("-")[1]); };

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


export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [needsNameSetup, setNeedsNameSetup] = useState(false);
  const [view, setView] = useState<"calendar" | "analytics" | "prep" | "archive">(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved === 'calendar' || saved === 'analytics' || saved === 'prep' || saved === 'archive') ? saved : 'calendar';
  });
  const [regionFilter, setRegionFilter] = useState(() => localStorage.getItem('regionFilter') || "すべて");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem('typeFilter') || "すべて");
  const [monthFilter, setMonthFilter] = useState(() => localStorage.getItem('monthFilter') || "すべて");
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
  const [calendarMobileLayout, setCalendarMobileLayout] = useState<"list" | "month" | "week" | "day">("list");
  const [mobileWeekRowIndex, setMobileWeekRowIndex] = useState(0);
  const [mobileAgendaDay, setMobileAgendaDay] = useState(() => new Date().getDate());
  const [sideOpen, setSideOpen] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [searchQuery, setSearchQuery] = useState("");
  const [prepEvent, setPrepEvent] = useState<Event | null>(null);
  const [modalTab, setModalTab] = useState<'detail' | 'photos'>('detail');
  const [eventStats, setEventStats] = useState({ itemCount: 0, preparedCount: 0, budget: 0 });
  const [dbEvents, setDbEvents] = useState<Record<string, Event>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastEditedId, setLastEditedId] = useState<string | null>(() => localStorage.getItem('lastEditedId'));
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // 未保存変更の警告（ブラウザを閉じる・リロード時）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '未保存の変更があります。ページを離れますか？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      if (u) {
        if (!u.displayName?.trim()) {
          setNeedsNameSetup(true);
        } else {
          setNeedsNameSetup(false);
          registerFcmToken(u.uid);
          recordUserLogin(u).catch(error => {
            console.error('User profile upsert error:', error);
          });
        }
      } else {
        setNeedsNameSetup(false);
      }
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

  const canEditEvent = computeCanEditEvent(user, narrowViewport);
  const canEditPreparationList = computeCanEditPreparationList(user);

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
        const items = snapshot.docs.map(d => d.data() as PreparationItem);
        setEventStats({
          itemCount: items.length,
          preparedCount: items.filter(i => i.prepared).length,
          budget: items.reduce((s, i) => s + (i.amount || 0) + (i.shippingFee || 0), 0),
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
    return allEvents.filter(d => {
      if (regionFilter !== "すべて" && d.region !== regionFilter) return false;
      if (typeFilter !== "すべて" && d.type !== typeFilter) return false;
      if (monthFilter !== "すべて") {
        const m = parseInt(monthFilter);
        if (getMonth(d.start) !== m && getMonth(d.end) !== m) return false;
      }
      if (q && !d.venue.toLowerCase().includes(q) && !(d.client || "").toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.start || "9999") < (b.start || "9999") ? -1 : 1);
  }, [allEvents, regionFilter, typeFilter, monthFilter, searchQuery]);

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

  const { data: analyticsData, loading: analyticsLoading, prepProgress } = useAnalytics(allEvents);
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
    // バリデーションエラーをクリア
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
      await setDoc(doc(db, "events", selected.id), selected);
      // 楽観的にローカルキャッシュも更新（onSnapshot反映までのラグ対策）
      setDbEvents(prev => ({ ...prev, [selected.id]: selected }));
      setHasUnsavedChanges(false);
      setLastEditedId(selected.id);
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '✏️ イベント更新', body: `${selected.venue} が更新されました` }),
      }).catch(console.error);
      setIsSaving(false);
      if (canEditEvent && user) {
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
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '📅 新しいイベント', body: `${newEvent.venue} が作成されました` }),
      }).catch(console.error);
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

  const handleDeleteEvent = async () => {
    if (!selected) return;
    const confirmed = window.confirm(
      `「${selected.venue}」を削除しますか？\n準備物リストも含めてすべて削除されます。この操作は元に戻せません。`
    );
    if (!confirmed) return;

    const eventId = selected.id;
    const deletedVenue = selected.venue;

    // モーダルを即座に閉じ、UIから楽観的に削除
    setSelected(null);
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setModalTab('detail');
    setDbEvents(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    try {
      // preparationItems サブコレクションを全件削除
      const prepPath = `events/${eventId}/preparationItems`;
      const prepSnapshot = await getDocs(collection(db, prepPath));
      await Promise.all(prepSnapshot.docs.map(d => deleteDoc(d.ref)));

      // イベント本体を削除
      await deleteDoc(doc(db, 'events', eventId));
      if (user) notifyEventDeleted(deletedVenue, eventId, user).catch(console.error);
    } catch (error) {
      console.error('Delete error:', error);
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

  // モーダルを閉じる（未保存の変更がある場合は確認）
  const handleCloseModal = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!window.confirm('未保存の変更があります。破棄しますか？')) {
        return;
      }
    }
    setSelected(null);
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

  if (user === undefined) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 8px 32px rgba(79,70,229,0.35)' }}>EX</div>
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full dot-bounce" style={{ background: 'var(--primary)' }} />
          <span className="w-1.5 h-1.5 rounded-full dot-bounce" style={{ background: 'var(--primary)' }} />
          <span className="w-1.5 h-1.5 rounded-full dot-bounce" style={{ background: 'var(--primary)' }} />
        </div>
      </div>
    </div>
  );
  if (!user) return <LoginScreen />;
  if (needsNameSetup) return (
    <ProfileSetupScreen
      user={user}
      onComplete={() => {
        setNeedsNameSetup(false);
        registerFcmToken(user.uid);
        recordUserLogin(user).catch(error => {
          console.error('User profile upsert error:', error);
        });
      }}
    />
  );

  return (
    <div className="flex flex-col min-h-screen h-dvh w-full" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)', transition: 'background-color 0.4s, color 0.4s' }}>
      {/* ── Header ── */}
      <header
        className="h-14 flex items-center justify-between px-4 sticky top-0 z-30 gap-4"
        style={{
          background: 'var(--bg-header)',
          borderBottom: '1px solid var(--border-light)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setSideOpen(v => !v)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Menu size={18} />
          </button>

          {/* Logo */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
            }}
          >
            EX
          </div>

          <div className="hidden sm:block">
            <div className="font-bold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>Ivent Manager</div>
            <div className="text-[10px] font-bold tracking-tight" style={{ color: 'var(--text-muted)' }}>Preparation & Scheduling</div>
          </div>
          <div className="sm:hidden flex flex-col">
            <div className="text-[10px] font-black tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{calYear}年{calMonth}月</div>
            <div className="font-black text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
              {view === 'calendar' ? 'カレンダー' : view === 'analytics' ? '分析' : view === 'prep' ? '準備物リスト' : 'アーカイブ'}
            </div>
          </div>
        </div>

        {/* Centre: Search */}
        <div className="flex-1 max-w-sm md:max-w-xl xl:max-w-2xl">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="会場・クライアントを検索..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <kbd
              className="hidden sm:block text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View switcher */}
          <div
            className="hidden md:flex p-1 rounded-xl gap-0.5"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            {[
              { id: "calendar",  icon: <Calendar size={13} />,     label: "カレンダー" },
              { id: "analytics", icon: <BarChart2 size={13} />,    label: "分析" },
              { id: "prep",      icon: <ClipboardList size={13} />, label: "準備物" },
              { id: "archive",   icon: <Archive size={13} />,       label: "アーカイブ" },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id as any)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
                style={view === v.id
                  ? { background: 'var(--primary)', color: '#fff', boxShadow: '0 2px 8px var(--primary-glow)' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                {v.icon}
                <span className="hidden md:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setIsDark(v => !v)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
            title={isDark ? 'ライトモード' : 'ダークモード'}
          >
            <span className="text-sm leading-none">{isDark ? '☀️' : '🌙'}</span>
          </button>

          {/* New event */}
          {!narrowViewport && (
            <motion.button
              onClick={() => handleCreateEvent()}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
              }}
            >
              <Plus size={13} strokeWidth={3} />
              <span className="hidden sm:inline">新規イベント</span>
            </motion.button>
          )}

          <NotificationCenter />

          {/* Avatar */}
          <div className="flex items-center gap-1.5">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="w-8 h-8 rounded-full"
                style={{ border: '2px solid var(--primary-glow)', boxShadow: '0 0 0 2px var(--primary-light)' }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
              >
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <button
              onClick={() => auth.signOut()}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              title="ログアウト"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        {sideOpen && (
          <aside
            className="w-64 flex flex-col flex-shrink-0 overflow-y-auto hidden md:flex"
            style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)' }}
          >
            <div className="p-5 space-y-6">

              {/* TODAY */}
              <div
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 60%, #2563EB 100%)',
                  boxShadow: '0 4px 20px rgba(79,70,229,0.3)',
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 translate-x-6 -translate-y-6" style={{ background: 'white' }} />
                <div className="relative">
                  <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">TODAY</div>
                  <div className="text-5xl font-black text-white tracking-tighter leading-none tabular-nums">
                    {new Date().getDate()}
                  </div>
                  <div className="text-xs font-bold text-white/60 mt-1">
                    {new Date().toLocaleDateString('ja-JP', { month: 'long', weekday: 'long' })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/15 flex items-center gap-2">
                    <span className="text-white/60 text-[11px] font-bold">{stats.total} イベント</span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-white/60 text-[11px] font-bold">{filtered.length} 表示中</span>
                  </div>
                </div>
              </div>

              {/* WORKSPACE */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>WORKSPACE</div>
                {[
                  { label: "すべてのイベント", icon: <Calendar size={13} />, count: stats.total },
                  { label: "準備中", icon: <ClipboardList size={13} />, count: stats.byStatus["準備中"] },
                  { label: "入荷待ち", icon: <Building2 size={13} />, count: stats.byStatus["入荷待ち"] },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setRegionFilter("すべて"); setTypeFilter("すべて"); setMonthFilter("すべて"); }}
                    className="group w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: 'var(--primary)' }}>{item.icon}</span>
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
                    >
                      {item.count || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* REGION */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>本部</span>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>REGION</span>
                </div>
                {(["すべて", ...REGIONS] as const).map(label => {
                  const active = regionFilter === label;
                  return (
                    <button
                      key={label}
                      onClick={() => setRegionFilter(label)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150"
                      style={active
                        ? { background: 'var(--primary-light)', color: 'var(--primary)' }
                        : { color: 'var(--text-secondary)' }
                      }
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: label === 'すべて' ? 'var(--text-muted)' : rs(label).dot }}
                        />
                        <span className="text-xs font-bold">{label}</span>
                      </div>
                      {label !== 'すべて' && (
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {stats.byRegion[label] || 0}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* TYPE */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>種別</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>TYPE</span>
                    <button
                      onClick={() => {
                        const newType = prompt("新しい案件種別を入力してください:");
                        const trimmed = newType?.trim() ?? '';
                        if (!trimmed || trimmed.length > 50) return;
                        if (sidebarTypes.some(t => t.label === trimmed)) { alert('その種別は既に存在します'); return; }
                        const icon = prompt("絵文字アイコンを入力してください (任意):", "📋") || "📋";
                        setSidebarTypes(prev => [...prev, { label: trimmed, icon }]);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded-md transition-colors"
                      style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setTypeFilter("すべて")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150"
                  style={typeFilter === 'すべて'
                    ? { background: 'var(--primary-light)', color: 'var(--primary)' }
                    : { color: 'var(--text-secondary)' }
                  }
                  onMouseEnter={e => { if (typeFilter !== 'すべて') e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { if (typeFilter !== 'すべて') e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="text-sm">📁</span>
                  <span className="text-xs font-bold">すべて</span>
                </button>
                {sidebarTypes.map(type => {
                  const active = typeFilter === type.label;
                  return (
                    <div key={type.label} className="group relative flex items-center">
                      <button
                        onClick={() => setTypeFilter(type.label)}
                        className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150"
                        style={active
                          ? { background: 'var(--primary-light)', color: 'var(--primary)' }
                          : { color: 'var(--text-secondary)' }
                        }
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span className="text-sm">{type.icon}</span>
                        <span className="text-xs font-bold">{type.label}</span>
                      </button>
                      {sidebarTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteType(type.label); }}
                          className="absolute right-1 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-all"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                          aria-label={`${type.label}を削除`}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </aside>
        )}

        {/* ── Main Content ── */}
        <main
          className="flex-1 relative overflow-hidden flex flex-col"
          style={{ background: 'var(--bg-app)' }}
        >
          <div className="p-4 md:p-6 pb-20 md:pb-6 flex-1 overflow-y-auto w-full max-w-none">
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
              className="w-full max-w-none"
            >
              {/* Desktop: Calendar grid / Mobile: Timeline list */}
              {view === "calendar" && (
                <>
                  <div className="hidden md:flex md:flex-col md:min-h-[calc(100dvh-9rem)]">
                    <CalendarView
                      events={desktopCalendarEvents}
                      year={calYear} month={calMonth}
                      setYear={setCalYear} setMonth={setCalMonth}
                      onSelect={handleEventSelect}
                      onHover={handleEventHover}
                      onHoverEnd={handleEventHoverEnd}
                      onCreateEvent={handleCreateEvent}
                      onOpenDayDetail={handleOpenDayDetail}
                      lastEditedId={lastEditedId}
                      densityPreview={calendarDensityPreview}
                    />
                  </div>
                  <div className="md:hidden space-y-3">
                    <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="カレンダー表示の切替">
                      {(
                        [
                          ["list", "一覧"],
                          ["month", "月"],
                          ["week", "週"],
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
                            if (id === "week") {
                              const cells = buildMonthGridCells(calYear, calMonth);
                              const wRows = cells.length / 7;
                              const t = new Date();
                              let w = 0;
                              if (t.getFullYear() === calYear && t.getMonth() + 1 === calMonth) {
                                const td = t.getDate();
                                outer: for (let wi = 0; wi < wRows; wi++) {
                                  for (let c = 0; c < 7; c++) {
                                    const cell = cells[wi * 7 + c];
                                    if (cell.current && cell.day === td) {
                                      w = wi;
                                      break outer;
                                    }
                                  }
                                }
                              }
                              setMobileWeekRowIndex(w);
                            }
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
                        <MobileWeekStrip year={calYear} month={calMonth} events={filtered} />
                        <div className="mt-4">
                          {filtered.length === 0 ? <EmptyState /> : <MobileTimelineView events={filtered} onSelect={handleEventSelect} />}
                        </div>
                      </>
                    )}
                    {calendarMobileLayout === "month" && (
                      <div className="-mx-1 overflow-x-auto px-1 pb-2">
                        <CalendarView
                          events={desktopCalendarEvents}
                          year={calYear}
                          month={calMonth}
                          setYear={setCalYear}
                          setMonth={setCalMonth}
                          onSelect={handleEventSelect}
                          onHover={handleEventHover}
                          onHoverEnd={handleEventHoverEnd}
                          onCreateEvent={handleCreateEvent}
                          onOpenDayDetail={handleOpenDayDetail}
                          lastEditedId={lastEditedId}
                          densityPreview={calendarDensityPreview}
                        />
                      </div>
                    )}
                    {calendarMobileLayout === "week" && (
                      <MobileMonthWeekGrid
                        year={calYear}
                        month={calMonth}
                        weekRowIndex={mobileWeekRowIndex}
                        onWeekRowChange={setMobileWeekRowIndex}
                        events={desktopCalendarEvents}
                        onSelect={handleEventSelect}
                        onOpenDayDetail={handleOpenDayDetail}
                        onCreateEvent={handleCreateEvent}
                      />
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
                      />
                    )}
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
                return (
                  <div className="flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-0">
                    <div className="py-2 md:py-4 w-full">
                      <h2 className="text-base md:text-lg font-black mb-1 md:mb-3" style={{ color: 'var(--text-primary)' }}>準備物リスト</h2>
                      <p className="hidden md:block text-xs mb-4" style={{ color: 'var(--text-muted)' }}>進行中のイベントを選択して準備物を管理します</p>
                      {activeEvents.length === 0 ? (
                        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>進行中のイベントがありません</div>
                      ) : (
                        <EventPickerList
                          events={activeEvents}
                          prepProgress={prepProgress}
                          onSelect={setPrepEvent}
                          variant="active"
                        />
                      )}
                    </div>
                  </div>
                );
              })() : view === "archive" ? (() => {
                const today = new Date().toISOString().slice(0, 10);
                const archivedEvents = [...allEvents]
                  .filter(ev => ev.end < today)
                  .sort((a, b) => b.end.localeCompare(a.end));
                return (
                  <div className="flex flex-col h-full w-full overflow-y-auto pb-20 md:pb-0">
                    <div className="py-2 md:py-4 w-full">
                      <h2 className="text-base md:text-lg font-black mb-1" style={{ color: 'var(--text-primary)' }}>アーカイブ</h2>
                      <p className="text-xs mb-3 md:mb-4" style={{ color: 'var(--text-muted)' }}>終了したイベントの準備物を確認できます</p>
                      {archivedEvents.length === 0 ? (
                        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>アーカイブされたイベントがありません</div>
                      ) : (
                        <EventPickerList
                          events={archivedEvents}
                          prepProgress={prepProgress}
                          onSelect={setPrepEvent}
                          variant="archive"
                        />
                      )}
                    </div>
                  </div>
                );
              })() : null}
              {view === "analytics" && analyticsData && (
                <AnalyticsDashboard data={analyticsData} loading={analyticsLoading} events={allEvents} />
              )}
              {view === "analytics" && !analyticsData && analyticsLoading && (
                <AnalyticsDashboard data={{ totalEvents: 0, completedEvents: 0, totalBudget: 0, avgBudget: 0, completionRate: 0, onTimeRate: 0, avgPreparationDays: 0, activeRegions: 0, topVenues: [], topRegion: '', busiestMonth: '', monthlyTrends: [], regionStats: [], typeStats: [], clientStats: [], totalSales: 0, totalGrossProfit: 0, totalAttendance: 0, totalSeatedCount: 0, totalContracts: 0, avgCarrierSwitchRate: 0, carrierInflowTotal: { docomo: 0, au: 0, softbank: 0, rakuten: 0, other: 0 } }} loading={true} />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {dayDetail && (
          <div key="day-detail" className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
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
              className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border border-gray-100 bg-white shadow-2xl max-md:max-h-[92dvh] max-md:rounded-b-none max-md:border-b-0 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl lg:max-w-3xl xl:max-w-4xl md:rounded-3xl w-full"
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 md:hidden" aria-hidden />
              <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-start gap-3 shrink-0">
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
              <div className="overflow-y-auto p-4 md:p-5 md:grid md:grid-cols-2 md:gap-3 md:auto-rows-min space-y-2 md:space-y-0 flex-1 min-h-0">
                {dayDetail.events.map((ev) => {
                  const typeSty = ts(ev.type || "");
                  const optionalLine = buildEventOptionalCaption(ev);
                  return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handlePickEventFromDayDetail(ev)}
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
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 backdrop-blur-md"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-t-3xl md:rounded-3xl relative z-10 overflow-hidden flex flex-col w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[92vh] md:max-h-[90vh]"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
                <div className="p-6 md:p-7 overflow-y-auto overflow-x-hidden">
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
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${!canEditEvent ? 'cursor-default' : 'cursor-pointer'}`}
                            style={selected.region === r
                              ? { background: rs(r).dot, color: '#fff', borderColor: 'transparent' }
                              : { background: 'var(--surface-raised)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
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
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${!canEditEvent ? 'cursor-default' : 'cursor-pointer'}`}
                            style={selected.type === t.label
                              ? { background: 'var(--primary)', color: '#fff', borderColor: 'transparent' }
                              : { background: 'var(--surface-raised)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                            }
                          >
                            <span>{t.icon}</span><span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="h-px mb-4" style={{ background: 'var(--border-light)' }} />

                  {/* タブ切替 */}
                  <div className="flex rounded-xl p-1 mb-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                    {[
                      { id: 'detail', label: '詳細' },
                      { id: 'photos', label: `写真${selected.photos?.length ? ` (${selected.photos.length})` : ''}` },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setModalTab(t.id as any)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={modalTab === t.id
                          ? { background: 'var(--primary)', color: '#fff', boxShadow: 'var(--shadow-sm)' }
                          : { color: 'var(--text-muted)' }
                        }
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* 写真タブ */}
                  {modalTab === 'photos' && (
                    <div className="space-y-4">
                      {canEditEvent && (selected.photos?.length ?? 0) < 3 && (
                        <PhotoUpload
                          onUpload={async (file) => { await uploadPhoto(file); }}
                          uploading={photoUploading}
                          uploadProgress={photoUploading ? uploadProgress : 0}
                          currentCount={selected.photos?.length ?? 0}
                          maxPhotos={3}
                        />
                      )}
                      {canEditEvent && (selected.photos?.length ?? 0) >= 3 && (
                        <p className="text-xs text-center text-slate-400 py-2">写真は最大3枚までです</p>
                      )}
                      {photoError && <p className="text-xs text-red-500 font-bold">{photoError}</p>}
                      <PhotoGallery
                        photos={selected.photos || []}
                        onDelete={photo => deleteEventPhoto(photo)}
                        onUpdateCaption={(photo, caption) => updatePhotoCaption(photo, caption)}
                        canEdit={canEditEvent}
                      />
                    </div>
                  )}

                  {/* フィールド */}
                  {modalTab === 'detail' && <><div className="space-y-4 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-4 md:space-y-0">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>VENUE・会場</label>
                      <input
                        className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all"
                        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        value={selected.venue}
                        placeholder="会場を入力..."
                        disabled={!canEditEvent}
                        onChange={e => handleUpdateEvent(selected.id, { venue: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:col-span-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>START</label>
                        <input
                          type="date"
                          className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all"
                          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                          value={selected.start}
                          disabled={!canEditEvent}
                          onChange={e => handleUpdateEvent(selected.id, { start: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>END</label>
                        <input
                          type="date"
                          className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all"
                          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                          value={selected.end}
                          disabled={!canEditEvent}
                          onChange={e => handleUpdateEvent(selected.id, { end: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>CLIENT・クライアント</label>
                      <input
                        className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all"
                        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        value={selected.client}
                        placeholder="クライアント名を入力..."
                        onChange={e => handleUpdateEvent(selected.id, { client: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>メモ</label>
                      <textarea
                        className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none min-h-[88px] resize-none transition-all"
                        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        value={selected.detailMemo ?? ''}
                        placeholder="例：搬入は西口ローリング床／15:00までに主電源・Wi-Fi確認"
                        readOnly={!user}
                        onChange={e => {
                          const detailMemo = e.target.value;
                          handleUpdateEvent(selected.id, {
                            detailMemo,
                            detailMemoAttribution: buildFieldAttribution(user) ?? selected.detailMemoAttribution,
                          });
                        }}
                      />
                      {formatAttributionLine(selected.detailMemoAttribution) ? (
                        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatAttributionLine(selected.detailMemoAttribution)}</p>
                      ) : null}
                      {!user && (
                        <p className="mt-1.5 text-[11px]" style={{ color: '#d97706' }}>ログインするとメモを記入・保存できます。</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>担当者</label>
                      <textarea
                        className="w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none min-h-[72px] resize-none transition-all"
                        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        value={selected.assigneeNote ?? ''}
                        placeholder="例：当日責任 山田／設営サポート 佐藤・伊藤／受付 外部スタッフ"
                        readOnly={!user}
                        onChange={e => {
                          const assigneeNote = e.target.value;
                          handleUpdateEvent(selected.id, {
                            assigneeNote,
                            assigneeNoteAttribution: buildFieldAttribution(user) ?? selected.assigneeNoteAttribution,
                          });
                        }}
                      />
                      {formatAttributionLine(selected.assigneeNoteAttribution) ? (
                        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatAttributionLine(selected.assigneeNoteAttribution)}</p>
                      ) : null}
                      {!user && (
                        <p className="mt-1.5 text-[11px]" style={{ color: '#d97706' }}>ログインすると担当者欄を記入・保存できます。</p>
                      )}
                    </div>

                  {/* 統計パネル */}
                  <div className="mt-1 md:col-span-2 rounded-2xl p-4 grid grid-cols-3 gap-0" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                    {[
                      { label: 'ITEMS', value: String(eventStats.itemCount), color: 'var(--text-primary)' },
                      { label: 'PREPARED', value: `${eventStats.preparedCount}/${eventStats.itemCount}`, color: 'var(--primary)' },
                      { label: 'BUDGET', value: `¥${eventStats.budget.toLocaleString()}`, color: 'var(--text-primary)' },
                    ].map((s, i) => (
                      <div key={s.label} className={`${i === 1 ? 'px-4 border-x' : i === 0 ? 'pr-4' : 'pl-4'}`} style={i === 1 ? { borderColor: 'var(--border)' } : {}}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                        <div className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* ボタン */}
                  <div className="mt-1 md:col-span-2 flex gap-2.5">
                    {hasUnsavedChanges && (
                      <motion.button
                        onClick={handleSaveEvent}
                        disabled={isSaving}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="flex-1 py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                        style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}
                      >
                        <Save size={15} />
                        {isSaving ? "保存中..." : "保存する"}
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => { if (selected) { setPrepEvent(selected); setView('prep'); setSelected(null); } }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex-1 py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}
                    >
                      <ClipboardList size={16} />
                      準備物リストを開く
                    </motion.button>
                  </div>
                  {canEditEvent && (
                    <button
                      onClick={handleDeleteEvent}
                      className="w-full md:col-span-2 mt-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                    >
                      <Trash2 size={15} />
                      このイベントを削除
                    </button>
                  )}

                  <AnimatePresence>
                    {validationErrors.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="mt-4 md:col-span-2 p-3 bg-red-50 border border-red-200 rounded-xl"
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
                        className="text-[10px] text-center text-amber-500 mt-4 md:col-span-2 font-bold tracking-widest"
                      >
                        ⚠️ 未保存の変更があります
                      </motion.p>
                    )}
                  </AnimatePresence>
                  </div>
                  </>}
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hover Preview Card（PC only） */}
      {hoveredEvent && (
        <HoverCard event={hoveredEvent} pos={hoverPos} prepProgress={prepProgress[hoveredEvent.id]} />
      )}

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around z-20 md:hidden"
        style={{
          background: 'var(--bg-header)',
          borderTop: '1px solid var(--border-light)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {[
          { id: "calendar", icon: <Calendar size={20} />,      label: "カレンダー" },
          { id: "prep",     icon: <ClipboardList size={20} />,  label: "準備物" },
          { id: "archive",  icon: <Archive size={20} />,        label: "アーカイブ" },
        ].map(tab => {
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { if (tab.id !== 'prep' && tab.id !== 'archive') setPrepEvent(null); setView(tab.id as any); }}
              className="flex flex-col items-center gap-0.5 px-6 py-3 text-[10px] font-bold transition-all relative"
              style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              {active && (
                <span
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'var(--primary)' }}
                />
              )}
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════
   サブコンポーネント
═══════════════════════════════════════ */

interface EventPickerListProps {
  events: Event[];
  prepProgress: Record<string, { prepared: number; total: number } | undefined>;
  onSelect: (event: Event) => void;
  variant: 'active' | 'archive';
}

function EventPickerList({ events, prepProgress, onSelect, variant }: EventPickerListProps) {
  const isArchive = variant === 'archive';

  return (
    <>
      <div
        className="hidden md:block rounded-2xl overflow-hidden w-full"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>会場</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>期間</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>本部</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hidden xl:table-cell" style={{ color: 'var(--text-muted)' }}>種別</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hidden xl:table-cell" style={{ color: 'var(--text-muted)' }}>クライアント</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest w-40" style={{ color: 'var(--text-muted)' }}>進捗</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {events.map(ev => {
              const prog = prepProgress[ev.id];
              const pct = prog && prog.total > 0 ? Math.round((prog.prepared / prog.total) * 100) : 0;
              const progressColor = isArchive ? (pct === 100 ? '#10b981' : 'var(--text-muted)') : 'var(--primary)';
              return (
                <tr
                  key={ev.id}
                  onClick={() => onSelect(ev)}
                  className={`cursor-pointer transition-colors ${isArchive ? 'opacity-90 hover:opacity-100' : ''}`}
                  style={{ borderBottom: '1px solid var(--border-light)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3.5 font-bold truncate max-w-[280px]" style={{ color: isArchive ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{ev.venue}</td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{ev.start} → {ev.end}</td>
                  <td className="px-4 py-3.5 text-xs hidden lg:table-cell" style={{ color: 'var(--text-secondary)' }}>{ev.region || '—'}</td>
                  <td className="px-4 py-3.5 text-xs hidden xl:table-cell" style={{ color: 'var(--text-secondary)' }}>{ev.type || '—'}</td>
                  <td className="px-4 py-3.5 text-xs hidden xl:table-cell truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{ev.client || '—'}</td>
                  <td className="px-4 py-3.5">
                    {prog && prog.total > 0 ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: progressColor }} />
                        </div>
                        <span className="text-xs font-black w-8 text-right tabular-nums" style={{ color: progressColor }}>{pct}%</span>
                      </div>
                    ) : (
                      <span className="block text-right text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="px-2 py-3.5" style={{ color: 'var(--text-muted)' }}>
                    <ChevronRight size={16} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {events.map(ev => {
          const prog = prepProgress[ev.id];
          const pct = prog && prog.total > 0 ? Math.round((prog.prepared / prog.total) * 100) : 0;
          const progressColor = isArchive ? (pct === 100 ? '#10b981' : 'var(--text-muted)') : 'var(--primary)';
          return (
            <button
              key={ev.id}
              onClick={() => onSelect(ev)}
              className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-center justify-between transition-all ${isArchive ? 'opacity-80 hover:opacity-100' : ''}`}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              onMouseEnter={e => { if (!isArchive) e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { if (!isArchive) e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="font-bold text-sm truncate" style={{ color: isArchive ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{ev.venue}</div>
                  {prog && prog.total > 0 && (
                    <span className="text-xs font-black shrink-0 ml-2" style={{ color: progressColor }}>{pct}%</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.start} → {ev.end}</div>
                {prog && prog.total > 0 && (
                  <div className="mt-2 w-full rounded-full h-1" style={{ background: 'var(--surface-hover)' }}>
                    <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: progressColor }} />
                  </div>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 ml-2" style={{ color: 'var(--text-muted)' }} />
            </button>
          );
        })}
      </div>
    </>
  );
}

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
  year: number;
  month: number;
  events: Event[];
}

function MobileWeekStrip({ year, month, events }: MobileWeekStripProps) {
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
              className={`flex min-h-[7.5rem] flex-col rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm ${
                isToday ? "ring-2 ring-indigo-400/40" : ""
              }`}
            >
              <div
                className={`mb-0.5 shrink-0 border-b border-slate-100 pb-0.5 text-center ${
                  !cell.current ? "text-slate-300" : isSun ? "text-red-500" : "text-slate-600"
                }`}
              >
                <div className="text-[9px] font-bold text-slate-400">{DAYS_JP[idx % 7]}</div>
                <div
                  className={`text-[11px] font-black tabular-nums ${
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
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: typeSty.border,
                        minHeight: CAL_EVENT_ROW_MIN_HEIGHT_TOUCH,
                      }}
                      title={captionNd || undefined}
                      aria-label={captionNd ? `${ev.venue}。${captionNd}` : ev.venue}
                      className="flex w-full shrink-0 items-center gap-0.5 overflow-hidden rounded border border-slate-200 bg-white px-0.5 text-left text-[10px] font-semibold leading-tight text-slate-900 ring-1 ring-inset ring-slate-900/[0.04]"
                    >
                      <span
                        className="h-1 w-1 shrink-0 rounded-full border border-slate-900/20"
                        style={{ backgroundColor: typeSty.border }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate whitespace-nowrap">{ev.venue}</span>
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

      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 text-sm font-bold text-indigo-700"
        onClick={() =>
          onCreateEvent({
            start: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          })
        }
      >
        この日にイベントを追加
      </button>
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
  lastEditedId: string | null;
  densityPreview?: boolean;
}

function CalendarView({ events, year, month, setYear, setMonth, onSelect, onHover, onHoverEnd, onCreateEvent, onOpenDayDetail, lastEditedId, densityPreview }: CalendarViewProps) {
  const cells = buildMonthGridCells(year, month);

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
    <div className="flex flex-col h-full w-full min-h-0 flex-1">
      {densityPreview && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold leading-snug text-amber-900">
          開発プレビュー: URL に <code className="rounded bg-white/80 px-1">?calPreview=density</code> を付けた状態です。月内の同一週に「0件 / 2件 / 4件 / 6件」のサンプル行が並びます（狭い画面では最大{MAX_EVENTS_IN_DAY_CELL_NARROW}件、それ以外は最大{MAX_EVENTS_IN_DAY_CELL}件まで表示し、残りは「+N件」から一覧を開けます。リロードで解除）。
        </div>
      )}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {monthNames[month]}
          <span className="font-bold ml-2 text-lg" style={{ color: 'var(--text-muted)' }}>{year}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }} onMouseEnter={e=>{e.currentTarget.style.color='var(--primary)';e.currentTarget.style.background='var(--primary-light)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.background='transparent';}}><ChevronLeft size={16} /></button>
          <button onClick={setToday} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }} onMouseEnter={e=>{e.currentTarget.style.color='var(--primary)';e.currentTarget.style.borderColor='var(--primary)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}>今日</button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }} onMouseEnter={e=>{e.currentTarget.style.color='var(--primary)';e.currentTarget.style.background='var(--primary-light)';}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.background='transparent';}}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div
        className="flex-1 grid min-h-0 grid-cols-7 rounded-2xl overflow-hidden"
        style={{
          gridTemplateRows: `auto repeat(${weekRows}, minmax(0, 1fr))`,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
          <div key={d} className="py-2.5 px-2" style={{ borderRight: i<6 ? '1px solid var(--border-light)' : 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: i===0 ? '#f87171' : i===6 ? '#60a5fa' : 'var(--text-muted)' }}>{d}</span>
          </div>
        ))}
        
        {cells.map((cell, idx) => {
          const isSun = idx % 7 === 0;
          const isToday = cell.current && today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === cell.day;
          const dayEvents = cell.current ? events.filter((ev) => eventCoversDate(ev, year, month, cell.day)) : [];
          const visibleEvents = dayEvents.slice(0, maxEventsInCell);
          const hiddenCount = Math.max(0, dayEvents.length - maxEventsInCell);

          return (
            <div
              key={idx}
              className="group relative flex h-full min-h-0 flex-col overflow-hidden px-1 pb-1.5 pt-1"
              style={{
                borderRight: idx % 7 < 6 ? '1px solid var(--border-light)' : 'none',
                borderBottom: '1px solid var(--border-light)',
                background: isToday ? 'var(--primary-light)' : cell.current ? 'var(--surface)' : 'var(--surface-raised)',
                minHeight: narrowViewport ? (isSixWeekMonth ? '104px' : '128px') : (isSixWeekMonth ? '120px' : '148px'),
                boxShadow: isToday ? 'inset 0 0 0 1.5px var(--primary-glow)' : 'none',
                transition: 'background 0.15s',
              }}
            >
              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="flex h-7 shrink-0 items-center px-0.5 mb-0.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <span
                    className="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums"
                    style={{
                      color: !cell.current ? 'var(--text-muted)' : isToday ? '#fff' : isSun ? '#f87171' : 'var(--text-primary)',
                      background: isToday ? 'var(--primary)' : 'transparent',
                      boxShadow: isToday ? 'var(--shadow-primary)' : 'none',
                    }}
                  >
                    {cell.day}
                  </span>
                  {cell.current && (
                    <button
                      type="button"
                      onClick={() => onCreateEvent({ start: `${year}-${String(month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}` })}
                      className="ml-auto w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
                      aria-label="イベントを追加"
                    >
                      <Plus size={10} />
                    </button>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col mt-0.5">
                  <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden" style={{ maxHeight: eventsPanelMaxHeight }}>
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
                        style={{ borderLeft: `3px solid ${typeSty.border}`, minHeight: eventRowMinHeight, background: `${typeSty.border}18` }}
                        aria-label={narrowViewport ? (captionNoDates ? `${ev.venue}。${captionNoDates}` : ev.venue) : (captionFull ? `${ev.venue}。${captionFull}` : ev.venue)}
                        className="flex w-full shrink-0 items-center gap-1 overflow-hidden rounded-r-md px-1 py-0.5 text-left transition-all hover:brightness-95"
                      >
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-semibold leading-tight max-xl:text-[10px]" style={{ color: 'var(--text-primary)' }}>
                          {ev.venue}
                        </span>
                      </button>
                    );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenDayDetail({ year, month, day: cell.day, events: dayEvents })}
                        style={{ minHeight: eventRowMinHeight, background: 'var(--primary-light)', color: 'var(--primary)' }}
                        className="w-full shrink-0 rounded-md px-1 py-0.5 flex items-center justify-center overflow-hidden transition hover:brightness-95 text-[11px] max-xl:text-[10px] font-bold"
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


interface ListViewProps {
  data: Event[];
  onSelect: (event: Event) => void;
  onHover: (event: Event, e: ReactMouseEvent<HTMLElement>) => void;
  onHoverEnd: () => void;
  lastEditedId: string | null;
}

function ListView({ data, onSelect, onHover, onHoverEnd, lastEditedId }: ListViewProps) {
  return (
    <div className="flex flex-col">
      {/* タイトル */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-baseline gap-2">
          All events
          <span className="text-slate-400 text-sm font-bold">· {data.length}</span>
        </h2>
      </div>

      {/* テーブル */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-100 rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3.5 font-black text-[10px] uppercase tracking-widest text-slate-400">DATE</th>
                <th className="px-6 py-3.5 font-black text-[10px] uppercase tracking-widest text-slate-400">本部</th>
                <th className="px-6 py-3.5 font-black text-[10px] uppercase tracking-widest text-slate-400">種別</th>
                <th className="px-6 py-3.5 font-black text-[10px] uppercase tracking-widest text-slate-400">会場</th>
                <th className="px-6 py-3.5 font-black text-[10px] uppercase tracking-widest text-slate-400 text-right">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => onSelect(d)}
                  onMouseEnter={(e) => onHover(d, e)}
                  onMouseLeave={onHoverEnd}
                  className={`
                    group cursor-pointer transition-colors
                    ${d.id === lastEditedId ? "bg-amber-50/50" : "hover:bg-slate-50/50"}
                  `}
                >
                  <td className="px-6 py-4 align-middle">
                    <div className="text-xs font-bold text-slate-700">
                      {fmtShort(d.start)}
                      {d.end && d.start !== d.end ? `-${fmtShort(d.end)}` : ""}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                      style={{ background: rs(d.region).bg, color: rs(d.region).text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: rs(d.region).dot }}></span>
                      {d.region}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 whitespace-nowrap">
                      <span>{d.emoji || ts(d.type || "").icon}</span>
                      {d.type || "その他"}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      {d.venue}
                      {d.id === lastEditedId && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded tracking-widest uppercase"
                        >
                          Updated
                        </motion.span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-medium">{d.client || "—"}</div>
                  </td>
                  <td className="px-6 py-4 align-middle text-right">
                    <span
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                      style={{ background: rs(d.region).bg }}
                    >
                      {d.status || "SCHEDULED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function HoverCard({ event, pos, prepProgress }: {
  event: Event;
  pos: { x: number; y: number };
  prepProgress?: { prepared: number; total: number };
}) {
  const left = pos.x + 260 > window.innerWidth ? pos.x - 270 : pos.x + 16;
  const top = pos.y + 240 > window.innerHeight ? pos.y - 220 : pos.y + 8;

  // prep progress logic
  const pct = prepProgress && prepProgress.total > 0
    ? Math.round((prepProgress.prepared / prepProgress.total) * 100)
    : null;
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(event.start || ''); start.setHours(0,0,0,0);
  const daysUntil = Math.ceil((start.getTime() - today.getTime()) / 86400000);

  const progressColor = pct === 100 ? '#10b981' : daysUntil <= 3 ? '#ef4444' : daysUntil <= 14 ? '#f59e0b' : '#6366f1';

  return (
    <div
      className="fixed z-[200] w-64 rounded-2xl p-4 pointer-events-none hidden md:block animate-scale-in"
      style={{
        left, top,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Colored top strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${ts(event.type || '').border}, transparent)` }} />

      <div className="flex items-start gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm"
          style={{ background: `${ts(event.type || '').border}20` }}
        >
          {event.emoji || ts(event.type || '').icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-black text-sm leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{event.venue}</div>
          <div className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--text-muted)' }}>{buildEventOptionalCaption(event) || (event.type || "その他")}</div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: rs(event.region || '').dot }} />
          <span style={{ color: 'var(--text-secondary)' }}>{event.region}</span>
        </div>
        <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          {event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ''}
        </div>
        {event.client && <div style={{ color: 'var(--text-secondary)' }}>{event.client}</div>}
        {event.note && <div className="line-clamp-2" style={{ color: 'var(--text-muted)' }}>{event.note}</div>}
        {pct !== null && prepProgress && prepProgress.total > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>準備進捗</span>
              <span className="text-[10px] font-black" style={{ color: progressColor }}>
                {prepProgress.prepared}/{prepProgress.total} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: progressColor }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterGroupProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <div className="space-y-4">
      <div className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 opacity-60">{label}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
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
    <div className="flex flex-col items-center justify-center py-24">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
      >
        <Calendar size={28} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>イベントが見つかりません</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>フィルターを変更するか、新規イベントを追加してください</div>
    </div>
  );
}
