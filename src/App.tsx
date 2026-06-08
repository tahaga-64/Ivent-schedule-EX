import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense, type MouseEvent as ReactMouseEvent } from 'react';
import { db, auth, loginWithGoogle, firebaseConfigError } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, addDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { buildPrepProgressMap } from './lib/prepProgress';
import { DATA } from './constants';
import { Event, EventPhoto, PreparationItem, EventStatus, type StaffMember } from './types';
import { buildMonthGridCells, type ValidationError, validateEvent } from './lib/eventHelpers';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import AccessDeniedScreen from './components/AccessDeniedScreen';
import { usePhotos } from './hooks/usePhotos';
import { useRoles } from './hooks/useRoles';
import {
  canEditPreparationList as computeCanEditPreparationList,
} from './lib/permissions';
import { checkUserAllowed } from './lib/allowedUsers';
import HelpModal from './components/HelpModal';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import DayDetailModal from './components/DayDetailModal';
import SavingIndicator from './components/SavingIndicator';
import MobileBottomNav from './components/MobileBottomNav';
import MobileMonthNav from './components/MobileMonthNav';
import MigrationBanner from './components/MigrationBanner';
import LoadingBar from './components/LoadingBar';
import LoadingSplash from './components/LoadingSplash';
import ViewLoadingFallback from './components/ViewLoadingFallback';
import { useRegisterUnsavedGuard, useUnsavedChanges } from './contexts/UnsavedChangesContext';

const HomeView = lazy(() => import('./components/HomeView'));
const MasterItemsView = lazy(() => import('./components/MasterItemsView'));
const FishListView = lazy(() => import('./components/FishListView'));
const LayoutView = lazy(() => import('./components/LayoutView'));
const LayoutPublicView = lazy(() => import('./components/LayoutView').then(m => ({ default: m.LayoutPublicView })));
const PreparationList = lazy(() => import('./components/PreparationList'));
const PrepEventList = lazy(() => import('./components/PrepEventList'));
const ArchiveView = lazy(() => import('./components/ArchiveView'));
const AlbumView = lazy(() => import('./components/AlbumView'));
const CalendarView = lazy(() => import('./components/CalendarComponents').then(m => ({ default: m.CalendarView })));
const HoverCard = lazy(() => import('./components/CalendarComponents').then(m => ({ default: m.HoverCard })));
const EmptyState = lazy(() => import('./components/CalendarComponents').then(m => ({ default: m.EmptyState })));
const MobileTimelineView = lazy(() => import('./components/CalendarComponents').then(m => ({ default: m.MobileTimelineView })));
const MobileWeekStrip = lazy(() => import('./components/CalendarComponents').then(m => ({ default: m.MobileWeekStrip })));
const MobileDayAgendaView = lazy(() => import('./components/CalendarComponents').then(m => ({ default: m.MobileDayAgendaView })));
const EventDetailModal = lazy(() => import('./components/EventDetailModal'));

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout" | "album";
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


const getMonth = (d: string) => { if (!d) return null; return parseInt(d.split("-")[1]); };

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
    const valid: ViewMode[] = ['calendar', 'prep', 'archive', 'home', 'master', 'fish', 'layout', 'album'];
    return valid.includes(saved as ViewMode) ? saved as ViewMode : 'home';
  });
  const [viewLoading, setViewLoading] = useState(false);
  const viewLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { runWithGuard } = useUnsavedChanges();

  const applySetView = useCallback((v: ViewMode) => {
    setViewLoading(true);
    if (viewLoadTimerRef.current) clearTimeout(viewLoadTimerRef.current);
    viewLoadTimerRef.current = setTimeout(() => setViewLoading(false), 400);
    setView(v);
  }, []);

  const navigateToView = useCallback((v: ViewMode) => {
    runWithGuard(() => {
      if (v !== 'prep' && v !== 'archive') setPrepEvent(null);
      applySetView(v);
    });
  }, [runWithGuard, applySetView]);

  const handleSetPrepEvent = useCallback((ev: Event | null) => {
    runWithGuard(() => setPrepEvent(ev));
  }, [runWithGuard]);

  const handleClearPrepEvent = useCallback(() => {
    runWithGuard(() => setPrepEvent(null));
  }, [runWithGuard]);
  const [regionFilter, setRegionFilter] = useState(() => localStorage.getItem('regionFilter') || "すべて");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem('typeFilter') || "すべて");
  // 月は常に「現在の月」で起動する（前回保存の古い月で固定されないように）
  const [monthFilter, setMonthFilter] = useState("すべて");
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [selected, setSelected] = useState<Event | null>(null);
  /** カレンダー日セルの「+N件」から開く、その日の全イベント一覧 */
  const [dayDetail, setDayDetail] = useState<{ year: number; month: number; day: number; events: Event[] } | null>(null);
  /** lg 未満のカレンダー画面: 一覧 / 月グリッド / 週 / 日 */
  const [calendarMobileLayout, setCalendarMobileLayout] = useState<"list" | "day">("list");
  const [mobileWeekRowIndex, setMobileWeekRowIndex] = useState(0);
  const [mobileAgendaDay, setMobileAgendaDay] = useState(() => new Date().getDate());
  const [sideOpen, setSideOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [prepEvent, setPrepEvent] = useState<Event | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('detail');
  const [eventStats, setEventStats] = useState({ itemCount: 0, preparedCount: 0, budget: 0 });
  const [dbEvents, setDbEvents] = useState<Record<string, Event>>({});
  const [eventsMigrated, setEventsMigrated] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
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
  const [pendingNewEventId, setPendingNewEventId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  // 静的DATA→Firestore 移行フラグを購読（appConfig/eventsMigration）
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'appConfig', 'eventsMigration'),
      (snap) => setEventsMigrated(snap.exists() && snap.data()?.done === true),
      () => {}, // ルール未デプロイ等は無視（移行前の挙動を維持）
    );
    return () => unsubscribe();
  }, []);

  // 初期データ(静的DATA)をFirestoreに取り込む（編集者のみ・既存は上書きしない）
  const handleSeedEvents = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      const batch = writeBatch(db);
      DATA.forEach(d => {
        if (!dbEvents[d.id]) {
          batch.set(doc(db, 'events', d.id), { ...d, status: 'scheduled' });
        }
      });
      batch.set(doc(db, 'appConfig', 'eventsMigration'), {
        done: true,
        migratedAt: new Date().toISOString(),
        migratedBy: user?.email ?? null,
      });
      await batch.commit();
    } catch (e) {
      console.error('seed events failed:', e);
      setSeedError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  };


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

  useEffect(() => {
    localStorage.setItem('viewMode', view);
    localStorage.setItem('regionFilter', regionFilter);
    localStorage.setItem('typeFilter', typeFilter);
    // 月（monthFilter / calMonth / calYear）は永続化しない＝起動時は常に当月
    if (lastEditedId) localStorage.setItem('lastEditedId', lastEditedId);
  }, [view, regionFilter, typeFilter, lastEditedId]);

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

  // 移行後はFirestoreのみを正とする（削除も反映）。移行前は従来どおり静的DATAとマージ
  const allEvents = useMemo(() => {
    if (eventsMigrated) {
      return Object.values(dbEvents);
    }
    const staticIds = new Set(DATA.map(d => d.id));
    const merged = DATA.map(item => dbEvents[item.id] || item);
    const firestoreOnly = Object.values(dbEvents).filter((e: Event) => !staticIds.has(e.id));
    return [...merged, ...firestoreOnly];
  }, [dbEvents, eventsMigrated]);

  const prepProgressMap = useMemo(() => buildPrepProgressMap(allEvents), [allEvents]);

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

  const mobileCalendarEvents = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return filtered.filter(ev => (ev.end || ev.start || '') >= todayStr);
  }, [filtered]);

  const {
    uploading: photoUploading,
    uploadProgress,
    error: photoError,
    uploadPhoto,
    deleteEventPhoto,
    updatePhotoCaption
  } = usePhotos(selected?.id || '');

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeEvents = allEvents.filter(ev =>
      ev.status !== 'completed' &&
      ev.status !== 'cancelled' &&
      (ev.end || ev.start || '') >= todayStr
    );

    const byRegion: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = { "scheduled": 0, "completed": 0, "cancelled": 0 };

    activeEvents.forEach(d => {
      if (d.region) byRegion[d.region] = (byRegion[d.region] || 0) + 1;
      if (d.type) byType[d.type] = (byType[d.type] || 0) + 1;
    });

    filtered.forEach(d => {
      if (d.status && d.status in byStatus) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });

    return { total: activeEvents.length, byRegion, byType, byStatus };
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
      if (pendingNewEventId !== null && selected.id === pendingNewEventId) {
        await setDoc(doc(db, 'events', selected.id), eventToSave);
        setPendingNewEventId(null);
      } else {
        await setDoc(doc(db, "events", selected.id), eventToSave);
      }
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

  const handleCreateEvent = useCallback((initialData: Partial<Event> = {}) => {
    runWithGuard(() => {
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
      setDbEvents(prev => ({ ...prev, [id]: newEvent }));
      setSelected(newEvent);
      setPendingNewEventId(id);
      setLastEditedId(id);
    });
  }, [runWithGuard]);

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

  const closeEventModal = useCallback(() => {
    const isNew = pendingNewEventId !== null && selected?.id === pendingNewEventId;
    if (isNew) {
      setDbEvents(prev => { const n = { ...prev }; delete n[pendingNewEventId!]; return n; });
      setPendingNewEventId(null);
    }
    setSelected(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setModalTab('detail');
  }, [pendingNewEventId, selected]);

  const discardEventChanges = useCallback(() => {
    const isNew = pendingNewEventId !== null && selected?.id === pendingNewEventId;
    if (isNew) {
      setDbEvents(prev => { const n = { ...prev }; delete n[pendingNewEventId!]; return n; });
      setPendingNewEventId(null);
    } else if (selected) {
      const original = dbEvents[selected.id];
      if (original) {
        setSelected(original);
        setLocalDailyRoles(original.dailyRoles ?? {});
      }
    }
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  }, [selected, pendingNewEventId, dbEvents]);

  useRegisterUnsavedGuard('event-modal', {
    enabled: !!selected,
    hasUnsaved: hasUnsavedChanges,
    save: handleSaveEvent,
    discard: discardEventChanges,
  });

  const handleCloseModal = useCallback(() => {
    runWithGuard(closeEventModal);
  }, [runWithGuard, closeEventModal]);

  const handleCancelNewEvent = useCallback(() => {
    runWithGuard(closeEventModal);
  }, [runWithGuard, closeEventModal]);

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
    runWithGuard(() => setSelected(ev));
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
    runWithGuard(() => {
      setDayDetail(null);
      setSelected(ev);
    });
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
  // 公開レイアウト共有リンク（認証・ローディングより前に判定し、共有相手にスプラッシュを出さない）
  const publicLayoutId = new URLSearchParams(window.location.search).get('layout');
  if (publicLayoutId) return (
    <Suspense fallback={<LoadingSplash />}>
      <LayoutPublicView eventId={publicLayoutId} />
    </Suspense>
  );
  if (accessDenied) return (
    <AccessDeniedScreen
      email={auth.currentUser?.email ?? null}
      onRetry={() => setAccessDenied(false)}
    />
  );
  if (user === undefined) return <LoadingSplash />;
  if (!user) return <LoginScreen />;
  if (needsNameSetup) return (
    <ProfileSetupScreen
      user={user}
      onComplete={() => {
        setNeedsNameSetup(false);
      }}
    />
  );

  const renderView = (v: ViewMode) => (
    <>
      {/* Desktop: Calendar grid / Mobile: Timeline list */}
      {v === "calendar" && (
        <>
          <div className="relative z-10">
          <div className="hidden md:flex md:flex-col md:min-h-[calc(100dvh-9rem)] w-full">
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
          <div className="md:hidden space-y-3">
            <MobileMonthNav
              year={calYear}
              month={calMonth}
              onPrev={() => {
                if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); }
                else setCalMonth(calMonth - 1);
              }}
              onNext={() => {
                if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); }
                else setCalMonth(calMonth + 1);
              }}
              onToday={() => {
                const d = new Date();
                setCalYear(d.getFullYear());
                setCalMonth(d.getMonth() + 1);
                setMobileAgendaDay(d.getDate());
              }}
            />
            <div className="flex gap-1 rounded-xl bg-white/10 border border-white/15 p-1" role="tablist" aria-label="カレンダー表示の切替">
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
                    calendarMobileLayout === id ? "bg-white text-indigo-700 shadow-sm" : "text-white/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {calendarMobileLayout === "list" && (
              <>
                <MobileWeekStrip events={mobileCalendarEvents} />
                <div className="mt-4">
                  {mobileCalendarEvents.length === 0 ? <EmptyState /> : <MobileTimelineView events={mobileCalendarEvents} onSelect={handleEventSelect} />}
                </div>
              </>
            )}
            {calendarMobileLayout === "day" && (
              <MobileDayAgendaView
                year={calYear}
                month={calMonth}
                agendaDay={mobileAgendaDay}
                setAgendaDay={setMobileAgendaDay}
                events={mobileCalendarEvents}
                onSelect={handleEventSelect}
                onOpenDayDetail={handleOpenDayDetail}
                onCreateEvent={handleCreateEvent}
                canEdit={canEditEvent}
              />
            )}
          </div>
          </div>
        </>
      )}
      {v === "home" && (
        <HomeView
          events={allEvents}
          prepProgressMap={prepProgressMap}
          onSelectEvent={handleEventSelect}
          onSelectPrepEvent={(ev) => { runWithGuard(() => { setPrepEvent(ev); applySetView('prep'); }); }}
          onCreateEvent={() => handleCreateEvent()}
          onOpenSchedule={() => window.open('https://ex-2026-04-802549538762.us-west1.run.app', '_blank', 'noopener,noreferrer')}
          onNavigateCalendar={() => applySetView('calendar')}
          canEditEvent={canEditEvent}
        />
      )}
      {v === "master" && (
        <MasterItemsView canEdit={canEditPreparationList} isActive />
      )}
      {v === "fish" && (
        <FishListView events={allEvents} canEdit={canEditPreparationList} isActive />
      )}
      {v === "layout" && (
        <LayoutView events={allEvents} canEdit={canEditPreparationList} />
      )}
      {v === "album" && (
        <AlbumView events={allEvents} />
      )}
      {(v === "prep" || v === "archive") && prepEvent ? (
        <PreparationList
          event={prepEvent}
          onBack={handleClearPrepEvent}
          canEdit={canEditPreparationList}
        />
      ) : v === "prep" ? (
        <PrepEventList events={allEvents} onSelectEvent={handleSetPrepEvent} />
      ) : v === "archive" ? (
        <ArchiveView events={allEvents} onSelectEvent={handleSetPrepEvent} />
      ) : null}
    </>
  );

  return (
    <div className="relative isolate flex flex-col h-dvh min-h-dvh overflow-hidden">
      <div className="absolute inset-0 -z-10 print:hidden"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0c1a35 100%)' }} />

      {/* ページ切替ローディングバー */}
      <LoadingBar visible={viewLoading} />

      {/* Header */}
      <AppHeader
        user={user}
        view={view}
        calYear={calYear}
        calMonth={calMonth}
        searchQuery={searchQuery}
        narrowViewport={narrowViewport}
        onToggleSidebar={() => setSideOpen(v => !v)}
        onSetView={navigateToView}
        onSearchChange={setSearchQuery}
        onCreateEvent={() => handleCreateEvent()}
        onShowHelp={() => setShowHelp(true)}
      />

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      {/* 初期データ移行バナー（編集者のみ・未移行時） */}
      {canEditEvent && !eventsMigrated && (
        <MigrationBanner
          seeding={seeding}
          seedError={seedError}
          onSeed={handleSeedEvents}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <AppSidebar
            open={sideOpen}
            onClose={() => setSideOpen(false)}
            stats={stats}
            regionFilter={regionFilter}
            setRegionFilter={setRegionFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            setMonthFilter={setMonthFilter}
            sidebarTypes={sidebarTypes}
            setSidebarTypes={setSidebarTypes}
            staffList={staffList}
            staffExpanded={staffExpanded}
            setStaffExpanded={setStaffExpanded}
            canEditEvent={canEditEvent}
            onAddStaff={handleAddStaff}
            onDeleteStaff={handleDeleteStaff}
            onEditStaffEmail={handleEditStaffEmail}
            onDeleteType={handleDeleteType}
          />

        {/* Main Content */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          <SavingIndicator
            isSaving={isSaving}
            saveError={saveError}
            onDismissError={() => setSaveError(null)}
          />

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={view + regionFilter + typeFilter + monthFilter + (prepEvent?.id ?? '')}
                className={`absolute inset-0 overflow-y-auto w-full max-w-none overscroll-contain ${
                  isMobile ? 'p-3 sm:p-4 pb-[calc(3.75rem+env(safe-area-inset-bottom))]' : 'p-4 md:p-6 lg:p-8 pb-20 md:pb-8'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
              >
                <Suspense fallback={<ViewLoadingFallback />}>
                  {renderView(view)}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {dayDetail && (
          <DayDetailModal
            key="day-detail"
            year={dayDetail.year}
            month={dayDetail.month}
            day={dayDetail.day}
            events={dayDetail.events}
            onClose={handleCloseDayDetail}
            onPickEvent={handlePickEventFromDayDetail}
          />
        )}
        {selected && (
          <Suspense fallback={null}>
          <EventDetailModal
            selected={selected}
            onClose={handleCloseModal}
            canEditEvent={canEditEvent}
            canUploadPhoto={canUploadPhoto}
            sidebarTypes={sidebarTypes}
            staffList={staffList}
            user={user ?? null}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            validationErrors={validationErrors}
            eventStats={eventStats}
            localDailyRoles={localDailyRoles}
            setLocalDailyRoles={setLocalDailyRoles}
            modalTab={modalTab}
            setModalTab={setModalTab}
            onUpdate={handleUpdateEvent}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            onOpenPrepList={() => {
              runWithGuard(() => {
                if (selected) setPrepEvent(selected);
                applySetView('prep');
                closeEventModal();
              });
            }}
            photoUploading={photoUploading}
            uploadProgress={uploadProgress}
            photoError={photoError}
            onUploadPhoto={async (file) => {
              const newPhoto = await uploadPhoto(file);
              if (newPhoto && hasUnsavedChanges) {
                setSelected(prev => prev ? { ...prev, photos: [...(prev.photos ?? []), newPhoto] } : prev);
              }
              return newPhoto;
            }}
            onDeletePhoto={async (photo) => {
              await deleteEventPhoto(photo);
              const filterPhotos = (photos: EventPhoto[] | undefined) =>
                (photos ?? []).filter(p => p.id !== photo.id);
              setSelected(prev => prev ? { ...prev, photos: filterPhotos(prev.photos) } : prev);
              setDbEvents(prev => {
                const ev = prev[selected.id];
                if (!ev) return prev;
                return { ...prev, [selected.id]: { ...ev, photos: filterPhotos(ev.photos) } };
              });
            }}
            onUpdatePhotoCaption={async (photo, caption) => {
              await updatePhotoCaption(photo, caption);
              setSelected(prev => prev ? { ...prev, photos: (prev.photos ?? []).map(p => p.id === photo.id ? { ...p, caption } : p) } : prev);
            }}
            isNewEvent={pendingNewEventId !== null && selected?.id === pendingNewEventId}
            onCancelNew={handleCancelNewEvent}
          />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Hover Preview Card（PC only） */}
      {hoveredEvent && (
        <Suspense fallback={null}>
          <HoverCard event={hoveredEvent} pos={hoverPos} prepStats={prepProgressMap[hoveredEvent.id]} />
        </Suspense>
      )}

      {/* モバイル FAB — 新規イベント作成 */}
      {canEditEvent && view === 'calendar' && (
        <button
          type="button"
          onClick={() => handleCreateEvent()}
          className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] right-4 z-30 md:hidden w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full shadow-xl shadow-indigo-500/40 flex items-center justify-center transition-all"
          aria-label="新規イベントを作成"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        view={view}
        onSetView={navigateToView}
      />
    </div>
  );
}
