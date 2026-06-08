import { useState, useMemo, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { db, auth, loginWithGoogle, firebaseConfigError } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, collectionGroup, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, addDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { DATA } from './constants';
import { Event, PreparationItem, EventStatus, type StaffMember } from './types';
import { buildMonthGridCells, type ValidationError, validateEvent } from './lib/eventHelpers';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, animate as motionAnimate } from 'motion/react';
import LoginScreen from './components/LoginScreen';
import ProfileSetupScreen from './components/ProfileSetupScreen';
import AccessDeniedScreen from './components/AccessDeniedScreen';
import PreparationList from './components/PreparationList';
import { usePhotos } from './hooks/usePhotos';
import { useRoles } from './hooks/useRoles';
import {
  canEditPreparationList as computeCanEditPreparationList,
} from './lib/permissions';
import HomeView from './components/HomeView';
import MasterItemsView from './components/MasterItemsView';
import FishListView from './components/FishListView';
import LayoutView, { LayoutPublicView } from './components/LayoutView';
import { checkUserAllowed } from './lib/allowedUsers';
import { CalendarView, HoverCard, EmptyState, MobileTimelineView, MobileWeekStrip, MobileDayAgendaView } from './components/CalendarComponents';
import EventDetailModal from './components/EventDetailModal';
import HelpModal from './components/HelpModal';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import DayDetailModal from './components/DayDetailModal';
import SavingIndicator from './components/SavingIndicator';
import MobileBottomNav from './components/MobileBottomNav';
import MigrationBanner from './components/MigrationBanner';
import LoadingBar from './components/LoadingBar';
import LoadingSplash from './components/LoadingSplash';
import PrepEventList from './components/PrepEventList';
import ArchiveView from './components/ArchiveView';

type ViewMode = "calendar" | "prep" | "archive" | "home" | "master" | "fish" | "layout";

const MOBILE_VIEWS: ViewMode[] = ['home', 'calendar', 'prep', 'master', 'fish', 'layout'];

function canScrollHorizontally(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node && node.tagName !== 'MAIN') {
    const style = window.getComputedStyle(node);
    const ox = style.overflowX;
    if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth) return true;
    node = node.parentElement;
  }
  return false;
}
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
    const valid: ViewMode[] = ['calendar', 'prep', 'archive', 'home', 'master', 'fish', 'layout'];
    return valid.includes(saved as ViewMode) ? saved as ViewMode : 'home';
  });
  const [viewLoading, setViewLoading] = useState(false);
  const viewLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSetView = useCallback((v: ViewMode) => {
    setViewLoading(true);
    if (viewLoadTimerRef.current) clearTimeout(viewLoadTimerRef.current);
    viewLoadTimerRef.current = setTimeout(() => setViewLoading(false), 400);
    setView(v);
  }, []);
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
  const [sideOpen, setSideOpen] = useState(true);
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
  const [pendingNewEventId, setPendingNewEventId] = useState<string | null>(null);
  const [swipeDir, setSwipeDir] = useState(0); // kept for non-mobile fade transitions
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeInsideScrollable = useRef(false);
  const dragActiveRef = useRef(false);
  const dragStartTime = useRef(0);

  // ── Seamless mobile carousel track ─────────────────────────────────
  // 全モバイルビューを横一列に常駐させ、単一の motion 値でトラックを平行移動する。
  // ビューはナビゲーション中に一切アンマウントされないため、スワイプ／タブ切替の
  // どちらでも再マウントによるチラつき・遅延が発生しない（GPU 合成の transform のみ）。
  const trackX = useMotionValue(0);
  const dragBaseX = useRef(0);
  const skipNextTrackAnim = useRef(false);
  const trackInitDone = useRef(false);
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0));
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setIsMobile(window.innerWidth < 1024); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    setPendingNewEventId(id);
    setLastEditedId(id);
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
    const isNew = pendingNewEventId !== null && selected?.id === pendingNewEventId;

    if (isNew && !hasUnsavedChanges) {
      setDbEvents(prev => { const n = { ...prev }; delete n[pendingNewEventId!]; return n; });
      setPendingNewEventId(null);
      setSelected(null);
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setValidationErrors([]);
      setModalTab('detail');
      return;
    }

    if (hasUnsavedChanges) {
      if (!window.confirm('未保存の変更があります。破棄しますか？')) return;
      if (isNew) {
        setDbEvents(prev => { const n = { ...prev }; delete n[pendingNewEventId!]; return n; });
        setPendingNewEventId(null);
      }
    }

    setSelected(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setModalTab('detail');
  }, [hasUnsavedChanges, pendingNewEventId, selected]);

  const handleCancelNewEvent = useCallback(() => {
    if (pendingNewEventId) {
      setDbEvents(prev => { const n = { ...prev }; delete n[pendingNewEventId]; return n; });
      setPendingNewEventId(null);
    }
    setSelected(null);
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setValidationErrors([]);
    setModalTab('detail');
  }, [pendingNewEventId]);

  // 現在ビューのトラック内インデックス（モバイルビュー以外は -1）
  const navIdx = MOBILE_VIEWS.indexOf(view);

  // view / 画面幅が変わったらトラックを該当ビュー位置へスプリングで移動。
  // スワイプ確定時は onTouchEnd 側で速度を引き継いだアニメをかけるため一度スキップ。
  useEffect(() => {
    if (!isMobile || navIdx < 0 || dragActiveRef.current) return;
    const target = -navIdx * vw;
    if (!trackInitDone.current) {
      trackX.set(target);
      trackInitDone.current = true;
      return;
    }
    if (skipNextTrackAnim.current) {
      skipNextTrackAnim.current = false;
      return;
    }
    const controls = motionAnimate(trackX, target, {
      type: 'spring', stiffness: 330, damping: 36, mass: 0.85,
    });
    return () => controls.stop();
  }, [navIdx, vw, isMobile, trackX]);

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
  // 公開レイアウト共有リンク（認証・ローディングより前に判定し、共有相手にスプラッシュを出さない）
  const publicLayoutId = new URLSearchParams(window.location.search).get('layout');
  if (publicLayoutId) return <LayoutPublicView eventId={publicLayoutId} />;
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
          </div>
        </>
      )}
      {v === "home" && (
        <HomeView
          events={allEvents}
          prepProgressMap={prepProgressMap}
          onSelectEvent={handleEventSelect}
          onSelectPrepEvent={(ev) => { setPrepEvent(ev); setView('prep'); }}
          onCreateEvent={() => handleCreateEvent()}
          onOpenSchedule={() => window.open('https://ex-2026-04-802549538762.us-west1.run.app', '_blank', 'noopener,noreferrer')}
          canEditEvent={canEditEvent}
        />
      )}
      {v === "master" && (
        <MasterItemsView canEdit={canEditPreparationList} />
      )}
      {v === "fish" && (
        <FishListView events={allEvents} canEdit={canEditPreparationList} />
      )}
      {v === "layout" && (
        <LayoutView events={allEvents} canEdit={canEditPreparationList} />
      )}
      {(v === "prep" || v === "archive") && prepEvent ? (
        <PreparationList
          event={prepEvent}
          onBack={() => setPrepEvent(null)}
          canEdit={canEditPreparationList}
        />
      ) : v === "prep" ? (
        <PrepEventList events={allEvents} onSelectEvent={setPrepEvent} />
      ) : v === "archive" ? (
        <ArchiveView events={allEvents} onSelectEvent={setPrepEvent} />
      ) : null}
    </>
  );

  return (
    <div className="relative isolate flex flex-col min-h-dvh">
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
        onSetView={handleSetView}
        onSearchChange={setSearchQuery}
        onCreateEvent={() => handleCreateEvent()}
        onShowHelp={() => setShowHelp(true)}
        onClearPrepEvent={() => setPrepEvent(null)}
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sideOpen && (
          <AppSidebar
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
        )}

        {/* Main Content */}
        <main
          className="flex-1 relative overflow-hidden flex flex-col"
          onTouchStart={e => {
            if (selected || !isMobile || navIdx < 0) return;
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            dragStartTime.current = Date.now();
            dragActiveRef.current = false;
            swipeInsideScrollable.current = canScrollHorizontally(e.target);
            dragBaseX.current = trackX.get();
          }}
          onTouchMove={e => {
            if (swipeInsideScrollable.current || !isMobile || navIdx < 0) return;
            const dx = e.touches[0].clientX - touchStartX.current;
            const dy = e.touches[0].clientY - touchStartY.current;

            if (!dragActiveRef.current) {
              if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                dragActiveRef.current = true;
                dragBaseX.current = trackX.get(); // 進行中アニメの現在位置を起点に
              } else {
                return;
              }
            }

            const minX = -(MOBILE_VIEWS.length - 1) * vw;
            const maxX = 0;
            let nx = dragBaseX.current + dx;
            // 端を超えたらゴムのように抵抗をかける
            if (nx > maxX) nx = maxX + (nx - maxX) * 0.3;
            else if (nx < minX) nx = minX + (nx - minX) * 0.3;
            trackX.set(nx);
          }}
          onTouchEnd={e => {
            if (!dragActiveRef.current) return;
            dragActiveRef.current = false;

            const dx = e.changedTouches[0].clientX - touchStartX.current;
            const dt = Math.max(1, Date.now() - dragStartTime.current);
            const velocity = dx / dt; // signed px/ms
            const passedThreshold = Math.abs(dx) > vw * 0.22 || Math.abs(velocity) > 0.35;

            let target = navIdx;
            if (passedThreshold) {
              if ((dx < 0 || velocity < -0.35) && navIdx < MOBILE_VIEWS.length - 1) target = navIdx + 1;
              else if ((dx > 0 || velocity > 0.35) && navIdx > 0) target = navIdx - 1;
            }

            // 速度を引き継いだスプリングでトラックを確定位置へ。
            motionAnimate(trackX, -target * vw, {
              type: 'spring', stiffness: 330, damping: 36, mass: 0.85,
              velocity: velocity * 1000, // px/s
            });

            if (target !== navIdx) {
              const nextView = MOBILE_VIEWS[target];
              if (nextView !== 'prep' && nextView !== 'archive') setPrepEvent(null);
              setSwipeDir(0);
              skipNextTrackAnim.current = true; // 上のアニメを尊重し effect 側の再アニメを抑止
              handleSetView(nextView);
            }
          }}
        >
          {/* Sync / Error Indicator — fixed positioned, stays outside animated region */}
          <SavingIndicator
            isSaving={isSaving}
            saveError={saveError}
            onDismissError={() => setSaveError(null)}
          />

          {/* View area: overflow-hidden clips off-screen slides */}
          <div className="flex-1 relative overflow-hidden">
            {isMobile && navIdx >= 0 ? (
              /* モバイル: 全ビュー常駐の横並びトラック（再マウントなしのシームレス遷移） */
              <motion.div
                className="flex h-full"
                style={{ x: trackX, width: `${MOBILE_VIEWS.length * 100}vw`, willChange: 'transform' }}
              >
                {MOBILE_VIEWS.map(v => (
                  <div
                    key={v}
                    className="h-full overflow-y-auto p-4"
                    style={{ width: '100vw', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
                  >
                    {renderView(v)}
                  </div>
                ))}
              </motion.div>
            ) : (
              /* デスクトップ / 非モバイルビュー: 軽量フェード */
              <AnimatePresence mode="wait">
                <motion.div
                  key={view + regionFilter + typeFilter + monthFilter}
                  className="absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                >
                  {renderView(view)}
                </motion.div>
              </AnimatePresence>
            )}
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
            onOpenPrepList={() => { setPrepEvent(selected); setView('prep'); setSelected(null); }}
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
              setSelected(prev => prev ? { ...prev, photos: (prev.photos ?? []).filter(p => p.id !== photo.id) } : prev);
            }}
            onUpdatePhotoCaption={async (photo, caption) => {
              await updatePhotoCaption(photo, caption);
              setSelected(prev => prev ? { ...prev, photos: (prev.photos ?? []).map(p => p.id === photo.id ? { ...p, caption } : p) } : prev);
            }}
            isNewEvent={pendingNewEventId !== null && selected?.id === pendingNewEventId}
            onCancelNew={handleCancelNewEvent}
          />
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
      <MobileBottomNav
        view={view}
        onSetView={(v) => { setSwipeDir(0); handleSetView(v); }}
        onClearPrepEvent={() => setPrepEvent(null)}
      />
    </div>
  );
}
