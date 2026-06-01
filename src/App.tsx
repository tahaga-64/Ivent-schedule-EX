import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense, type MouseEvent as ReactMouseEvent } from 'react';
import { db, auth, loginWithGoogle, firebaseConfigError } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, collectionGroup, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, addDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { DATA, REGIONS } from './constants';
import { Event, PreparationItem, EventStatus, type FieldAuthorAttribution } from './types';
import {
  rs, ts, fmtShort, fmtDateJP, fmtDateRange, daysUntil, statusStyle,
  getDaysInRange, formatDayLabel, buildEventOptionalCaption, eventCoversDate, buildMonthGridCells,
} from './lib/eventHelpers';
import { CalendarView, HoverCard, EmptyState } from './components/CalendarView';
import { MobileTimelineView, MobileWeekStrip, MobileDayAgendaView } from './components/MobileCalendarViews';
import { Calendar, Menu, X, ChevronLeft, ChevronRight, Building2, ClipboardList, Save, Plus, Search, LogOut, Trash2, Archive, Mail, Home, Package, Fish } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import AccessDeniedScreen from './components/AccessDeniedScreen';
import EXLogo from './components/EXLogo';
import PreparationList from './components/PreparationList';
import PhotoUpload from './components/photos/PhotoUpload';
import PhotoGallery from './components/photos/PhotoGallery';
import { usePhotos } from './hooks/usePhotos';
import { useRoles } from './hooks/useRoles';
import { MAX_PHOTOS } from './lib/photoStorage';
import {
  canEditPreparationList as computeCanEditPreparationList,
} from './lib/permissions';
import HomeView from './components/HomeView';
import { checkUserAllowed } from './lib/allowedUsers';

const FishListView = lazy(() => import('./components/FishListView'));
const MasterItemsView = lazy(() => import('./components/MasterItemsView'));

function ViewFallback() {
  return <div className="flex-1 flex items-center justify-center py-24 text-slate-400 text-sm">読み込み中...</div>;
}

interface StaffMember {
  id: string;
  name: string;
  email?: string;
}

type ViewMode = "calendar" | "prep" | "archive" | "home" | "fish" | "master";
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

const getMonth = (d: string) => { if (!d) return null; return parseInt(d.split('-')[1]); };

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
  const [accessDenied, setAccessDenied] = useState(false);
  const [needsNameSetup, setNeedsNameSetup] = useState(false);
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    const valid: ViewMode[] = ['calendar', 'prep', 'archive', 'home', 'fish', 'master'];
    return valid.includes(saved as ViewMode) ? saved as ViewMode : 'home';
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
  const [dailyRolesExpanded, setDailyRolesExpanded] = useState(false);
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

  // 他ユーザーの変更をモーダルにリアルタイム反映（未保存の編集中は上書きしない）
  useEffect(() => {
    if (!selected || hasUnsavedChangesRef.current) return;
    const latest = dbEvents[selected.id];
    if (latest) setSelected(latest);
  }, [dbEvents, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 日別役割のローカル状態をイベント切替時に初期化（Firestoreの同期と完全に分離）
  useEffect(() => {
    setLocalDailyRoles(selected?.dailyRoles ?? {});
    setDailyRolesExpanded(false);
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
    const byStatus: Record<string, number> = { "scheduled": 0, "in_progress": 0, "waiting": 0, "ready": 0, "completed": 0, "cancelled": 0 };

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

  // Kanbanビュー用: イベントステータスを直接Firestoreに保存
  const handleUpdateEventStatus = async (eventId: string, status: EventStatus) => {
    setDbEvents(prev => ({ ...prev, [eventId]: { ...prev[eventId], status } }));
    try {
      await updateDoc(doc(db, 'events', eventId), { status });
    } catch (e) {
      console.error('status update failed', e);
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
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url('/mercury-office.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-10"
      >
        <EXLogo size="lg" showSubtitle />
        <div className="w-40 h-[2px] bg-white/15 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400"
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.2 }}
          />
        </div>
      </motion.div>
    </div>
  );
  if (!user) return <LoginScreen />;
  if (needsNameSetup) return (
    <ProfileSetupScreen
      user={user}
      onComplete={() => {
        setNeedsNameSetup(false);
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
            <div className="font-black text-sm text-slate-800 leading-tight">{view === 'home' ? 'ホーム' : view === 'calendar' ? 'カレンダー' : view === 'fish' ? '魚リスト' : view === 'prep' ? '準備物リスト' : view === 'archive' ? 'アーカイブ' : view === 'master' ? '備品マスター' : ''}</div>
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
                { id: "home",     icon: <Home size={14} />,          label: "ホーム" },
                { id: "calendar", icon: <Calendar size={14} />,     label: "カレンダー" },
                { id: "fish",     icon: <Fish size={14} />,         label: "魚リスト" },
                { id: "prep",     icon: <ClipboardList size={14} />, label: "準備物" },
                { id: "archive",  icon: <Archive size={14} />,      label: "アーカイブ" },
                { id: "master",   icon: <Package size={14} />,      label: "備品" },
              ] as { id: ViewMode; icon: React.ReactNode; label: string }[]
            ).map(v => (
              <button
                key={v.id}
                onClick={() => { if (v.id !== 'prep' && v.id !== 'archive') setPrepEvent(null); setView(v.id); }}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${view === v.id ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}
                `}
              >
                {v.icon}
                <span className="hidden lg:inline">{v.label}</span>
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

          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-white" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs ring-2 ring-white">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
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
                  { label: "準備中", icon: <ClipboardList size={14} />, count: stats.byStatus["in_progress"] ?? 0, statusValue: "in_progress" },
                  { label: "入荷待ち", icon: <Building2 size={14} />, count: stats.byStatus["waiting"] ?? 0, statusValue: "waiting" },
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
                className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[100] flex items-center gap-3 bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 pointer-events-none"
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
                </>
              )}
              {view === "home" && (
                <HomeView
                  events={allEvents}
                  prepProgressMap={prepProgressMap}
                  onSelectEvent={handleEventSelect}
                />
              )}
              {view === "fish" && (
                <Suspense fallback={<ViewFallback />}>
                  <FishListView
                    events={allEvents}
                    canEdit={canEditPreparationList}
                  />
                </Suspense>
              )}
              {view === "master" && (
                <Suspense fallback={<ViewFallback />}>
                  <MasterItemsView canEdit={canEditPreparationList} />
                </Suspense>
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
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-black text-slate-800">準備物リスト</h2>
                        <span className="text-xs text-slate-400 font-bold">タップして開く →</span>
                      </div>
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
                                  const prog = prepProgressMap[ev.id];
                                  const progPct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : null;
                                  return (
                                    <button
                                      key={ev.id}
                                      onClick={() => setPrepEvent(ev)}
                                      className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm flex items-stretch overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all group"
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
                                        <div className="text-xs text-slate-400 truncate mb-1.5">{fmtDateRange(ev.start, ev.end)}</div>
                                        {prog && prog.total > 0 && (
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progPct}%` }} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 shrink-0">{prog.done}/{prog.total}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center pr-3 gap-1">
                                        <span className="text-[10px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">開く</span>
                                        <ChevronRight size={16} className="text-slate-300 shrink-0 group-hover:text-indigo-400 transition-colors" />
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
              className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col border border-gray-100 w-full lg:w-[780px] lg:max-w-[780px] max-h-[92vh] lg:max-h-[90vh]"
            >
                {selected.status === 'completed' && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 border-b border-orange-600 shrink-0">
                    <span className="text-white">⚑</span>
                    <span className="text-xs font-bold text-white">このイベントは終了しました</span>
                  </div>
                )}

                {/* 固定ヘッダー: タグ・閉じる・タブ */}
                <div className="px-5 lg:px-6 pt-4 pb-3 border-b border-gray-100 shrink-0">
                  <div className="flex justify-between items-start gap-3 mb-3">
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
                            style={selected.region === r ? { background: rs(r).dot, borderColor: rs(r).dot } : {}}
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
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex bg-slate-100 rounded-xl p-1">
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
                </div>

                {/* スクロール可能なコンテンツ */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {/* 写真タブ */}
                  {modalTab === 'photos' && (
                    <div className="p-5 lg:p-6 space-y-4">
                      {canUploadPhoto && (selected.photos?.length ?? 0) < MAX_PHOTOS && (
                        <PhotoUpload
                          onUpload={async (file) => {
                            const newPhoto = await uploadPhoto(file);
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

                  {/* 詳細タブ: PCは2カラム */}
                  {modalTab === 'detail' && (
                    <div className="lg:flex lg:divide-x lg:divide-gray-100">
                      {/* 左カラム: 基本情報 */}
                      <div className="p-5 lg:p-6 lg:flex-1 space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">VENUE・会場</label>
                          <input
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                            value={selected.venue}
                            placeholder="会場を入力..."
                            disabled={!canEditEvent}
                            onChange={e => handleUpdateEvent(selected.id, { venue: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">START</label>
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                              value={selected.start}
                              disabled={!canEditEvent}
                              onChange={e => handleUpdateEvent(selected.id, { start: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">END</label>
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                              value={selected.end}
                              disabled={!canEditEvent}
                              onChange={e => handleUpdateEvent(selected.id, { end: e.target.value })}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">CLIENT・クライアント</label>
                          <input
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                            value={selected.client}
                            placeholder="クライアント名を入力..."
                            disabled={!canEditEvent}
                            onChange={e => handleUpdateEvent(selected.id, { client: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">メモ</label>
                          <textarea
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none read-only:bg-gray-50 read-only:text-gray-500"
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
                          {formatAttributionLine(selected.detailMemoAttribution) && (
                            <p className="mt-1 text-[11px] text-gray-500">{formatAttributionLine(selected.detailMemoAttribution)}</p>
                          )}
                        </div>
                      </div>

                      {/* 右カラム: 担当・役割・ステータス */}
                      <div className="px-5 pb-5 pt-0 lg:pt-6 lg:w-[280px] lg:shrink-0 space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">担当者</label>
                          {staffList.length === 0 ? (
                            <p className="text-xs text-gray-400 py-1">サイドバーのスタッフ欄からメンバーを追加してください。</p>
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

                        {(selected.assignees ?? []).length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setDailyRolesExpanded(prev => !prev)}
                              className="w-full flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 hover:text-indigo-500 transition-colors"
                            >
                              <span>日別役割</span>
                              <span className="normal-case text-[10px] font-bold">{dailyRolesExpanded ? '▲ 閉じる' : '▼ 展開する'}</span>
                            </button>
                            {dailyRolesExpanded && (
                              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {getDaysInRange(selected.start, selected.end).map(date => (
                                  <div key={date} className="border border-gray-100 rounded-xl p-2.5 bg-gray-50/50">
                                    <div className="text-[11px] font-bold text-gray-500 mb-1.5">{formatDayLabel(date)}</div>
                                    <div className="space-y-1.5">
                                      {(selected.assignees ?? []).map(memberName => (
                                        <div key={memberName} className="flex items-center gap-2">
                                          <span className="text-xs font-medium text-gray-700 w-16 shrink-0 truncate">{memberName}</span>
                                          <input
                                            type="text"
                                            value={localDailyRoles?.[date]?.[memberName] ?? ''}
                                            disabled={!canEditEvent}
                                            placeholder="役割"
                                            onChange={e => {
                                              const val = e.target.value;
                                              setLocalDailyRoles(prev => ({
                                                ...prev,
                                                [date]: { ...(prev[date] ?? {}), [memberName]: val },
                                              }));
                                              hasUnsavedChangesRef.current = true;
                                              setHasUnsavedChanges(true);
                                            }}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {canEditEvent && (
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">ステータス</label>
                            <div className="flex flex-wrap gap-1.5">
                              {(['scheduled','in_progress','waiting','ready','completed','cancelled'] as const).map(s => {
                                const sty = statusStyle(s);
                                const isActive = (selected?.status ?? 'scheduled') === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleUpdateEvent(selected.id, { status: s })}
                                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
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
                    </div>
                  )}
                </div>

                {/* 固定フッター: 統計 + ボタン (詳細タブのみ) */}
                {modalTab === 'detail' && (
                  <div className="px-5 lg:px-6 py-4 border-t border-gray-100 shrink-0">
                    <div className="bg-gray-50 rounded-2xl py-3 px-4 grid grid-cols-3 divide-x divide-gray-200 mb-3">
                      <div className="pr-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">ITEMS</div>
                        <div className="text-xl font-black text-gray-800">{eventStats.itemCount}</div>
                      </div>
                      <div className="px-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">PREPARED</div>
                        <div className="text-xl font-black text-indigo-600">{eventStats.preparedCount}/{eventStats.itemCount}</div>
                      </div>
                      <div className="pl-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">BUDGET</div>
                        <div className="text-xl font-black text-gray-800">¥{eventStats.budget.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {hasUnsavedChanges && (
                        <button
                          onClick={handleSaveEvent}
                          disabled={isSaving}
                          className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-md shadow-amber-500/20"
                        >
                          <Save size={15} />
                          {isSaving ? "保存中..." : "保存する"}
                        </button>
                      )}
                      <button
                        onClick={() => { if (selected) { setPrepEvent(selected); setView('prep'); setSelected(null); } }}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
                      >
                        <ClipboardList size={16} />
                        準備物リストを開く
                      </button>
                    </div>
                    {canEditEvent && (
                      <button
                        onClick={handleDeleteEvent}
                        className="w-full mt-2 py-2.5 rounded-xl border border-red-200 text-sm font-bold text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} />
                        このイベントを削除
                      </button>
                    )}
                    <AnimatePresence>
                      {validationErrors.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl"
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
                          className="text-[10px] text-center text-amber-500 mt-3 font-bold tracking-widest"
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
            { id: "home",     icon: <Home size={20} />,          label: "ホーム" },
            { id: "calendar", icon: <Calendar size={20} />,      label: "カレンダー" },
            { id: "fish",     icon: <Fish size={20} />,          label: "魚リスト" },
            { id: "prep",     icon: <ClipboardList size={20} />, label: "準備物" },
            { id: "master",   icon: <Package size={20} />,       label: "備品" },
          ] as { id: ViewMode; icon: React.ReactNode; label: string }[]
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => { if (tab.id !== 'prep' && tab.id !== 'archive') setPrepEvent(null); setView(tab.id); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-3 text-[10px] font-bold transition-colors ${
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
