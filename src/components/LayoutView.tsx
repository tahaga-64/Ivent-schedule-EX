/**
 * LayoutView — 水族館イベント用フロアレイアウトプランナー
 *
 * 【公開URL】 /?layout=EVENT_ID  → 認証不要でクライアントがアクセス可能
 * 【管理画面】 アプリ内「レイアウト」ビュー → イベント選択→キャンバス
 *
 * Firestore: layouts/{eventId} = { items, customItems, photos, eventName, updatedAt }
 *   rules: layouts/{layoutId} は allow read, write: if isAuthenticated();
 */
import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Trash2, RotateCw, Copy, Check, ChevronRight, LayoutGrid, Plus, Maximize2, Minimize2, Image as ImageIcon, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Event, EventPhoto } from '../types';
import { uploadEventPhoto, deleteStoredPhoto, validateImageFile } from '../lib/photoStorage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LayoutItemData {
  id: string;
  type: string;
  label: string;
  x: number;   // center, 0–100 %
  y: number;   // center, 0–100 %
  rotation: number; // 0 | 90 | 180 | 270
  color: string;
  wPct: number;
  hPct: number;
  emoji?: string; // 配置アイテムに保持（カスタム種別でも単体で正しく描画できるように）
}

/** ユーザーが追加するカスタム配置アイテム（パレットに追加される） */
export interface CustomCatalogItem {
  key: string;    // 'custom_xxxxx'
  label: string;
  emoji: string;
  color: string;
  wPct: number;
  hPct: number;
}

const MAX_LAYOUT_PHOTOS = 12;

// ─── Item catalog ─────────────────────────────────────────────────────────────

const CATALOG: Record<string, {
  label: string; emoji: string; color: string; wPct: number; hPct: number;
}> = {
  round_table: { label: '丸机',           emoji: '⭕', color: '#6366f1', wPct: 8,  hPct: 9  },
  long_table:  { label: '長机',           emoji: '▭',  color: '#7c3aed', wPct: 16, hPct: 5  },
  fish_tank:   { label: '水槽',           emoji: '🐠', color: '#0369a1', wPct: 13, hPct: 8  },
  sandbox:     { label: '砂場',           emoji: '🏖️', color: '#b45309', wPct: 18, hPct: 12 },
  yoyo:        { label: 'ヨーヨー・SB',   emoji: '🎯', color: '#be123c', wPct: 14, hPct: 10 },
  seating:     { label: '着座SP',         emoji: '💺', color: '#0f766e', wPct: 16, hPct: 10 },
  pillar:      { label: '柱',             emoji: '⬛', color: '#475569', wPct: 4,  hPct: 6  },
  entrance:   { label: '入口',      emoji: '🚪', color: '#16a34a', wPct: 8,  hPct: 5  },
  prize_desk: { label: '景品お渡し', emoji: '🎁', color: '#db2777', wPct: 14, hPct: 8  },
  partition:  { label: '仕切り',     emoji: '🟫', color: '#64748b', wPct: 22, hPct: 2  },
};

function genId() { return Math.random().toString(36).slice(2, 9); }

// ─── Canvas ───────────────────────────────────────────────────────────────────

interface CanvasProps {
  eventId: string;
  eventName: string;
  canEdit: boolean;
  isPublic?: boolean;
}

export function LayoutCanvas({ eventId, eventName, canEdit, isPublic = false }: CanvasProps) {
  const [items, setItems] = useState<LayoutItemData[]>([]);
  const [customItems, setCustomItems] = useState<CustomCatalogItem[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [layoutExists, setLayoutExists] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const itemsRef = useRef<LayoutItemData[]>([]);
  const customItemsRef = useRef<CustomCatalogItem[]>([]);
  const photosRef = useRef<EventPhoto[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventIdRef = useRef(eventId);
  const eventNameRef = useRef(eventName);
  useEffect(() => { eventIdRef.current = eventId; eventNameRef.current = eventName; }, [eventId, eventName]);

  // Load
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'layouts', eventId),
      snap => {
        if (snap.exists()) {
          const d = snap.data() as { items?: LayoutItemData[]; customItems?: CustomCatalogItem[]; photos?: EventPhoto[] };
          const loaded = d.items ?? [];
          itemsRef.current = loaded;
          setItems(loaded);
          const ci = d.customItems ?? [];
          customItemsRef.current = ci;
          setCustomItems(ci);
          const ph = d.photos ?? [];
          photosRef.current = ph;
          setPhotos(ph);
          setLayoutExists(true);
        } else {
          itemsRef.current = []; setItems([]);
          customItemsRef.current = []; setCustomItems([]);
          photosRef.current = []; setPhotos([]);
          setLayoutExists(false);
        }
      },
      err => console.error('layout snapshot error:', err)
    );
    return unsub;
  }, [eventId]);

  // Firestore へ書き込み（items / customItems / photos をまとめて保存）
  async function writeLayout() {
    await setDoc(doc(db, 'layouts', eventIdRef.current), {
      items: itemsRef.current,
      customItems: customItemsRef.current,
      photos: photosRef.current,
      eventName: eventNameRef.current,
      updatedAt: serverTimestamp(),
    });
  }

  // ドラッグ等の連続操作はデバウンス保存
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await writeLayout(); setSavedAt(new Date()); }
      catch (err) { console.error('layout save error:', err); }
      finally { setSaving(false); }
    }, 700);
  }

  // 写真・カスタムアイテム等の単発操作は即時保存
  async function flushSave() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setSaving(true);
    try { await writeLayout(); setSavedAt(new Date()); }
    catch (err) { console.error('layout save error:', err); }
    finally { setSaving(false); }
  }

  function updateItems(next: LayoutItemData[]) {
    itemsRef.current = next;
    setItems(next);
    if (canEdit) scheduleSave();
  }

  function defOf(type: string) {
    return CATALOG[type] ?? customItemsRef.current.find(c => c.key === type) ?? null;
  }

  function addItem(type: string) {
    if (!canEdit) return;
    const def = defOf(type);
    if (!def) return;
    const sameType = itemsRef.current.filter(i => i.type === type).length;
    const num = (type === 'fish_tank' || type.startsWith('custom_')) && sameType > 0 ? String(sameType + 1) : (type === 'fish_tank' ? '1' : '');
    updateItems([...itemsRef.current, {
      id: genId(),
      type,
      label: num ? `${def.label}${num}` : def.label,
      x: 15 + Math.random() * 60,
      y: 15 + Math.random() * 60,
      rotation: 0,
      color: def.color,
      wPct: def.wPct,
      hPct: def.hPct,
      emoji: def.emoji,
    }]);
  }

  function addCustomItem() {
    if (!canEdit) return;
    const label = prompt('アイテム名を入力してください（例：受付、ステージ、休憩所）');
    const trimmed = label?.trim();
    if (!trimmed || trimmed.length > 24) return;
    const emoji = (prompt('絵文字を入力（任意）', '📦')?.trim() || '📦').slice(0, 4);
    const colorInput = prompt('色をHEXで入力（任意・例 #2563eb）', '#2563eb')?.trim() || '#2563eb';
    const color = /^#[0-9a-fA-F]{6}$/.test(colorInput) ? colorInput : '#2563eb';
    const next = [...customItemsRef.current, { key: 'custom_' + genId(), label: trimmed, emoji, color, wPct: 12, hPct: 9 }];
    customItemsRef.current = next;
    setCustomItems(next);
    void flushSave();
  }

  function deleteCustomItem(key: string) {
    if (!canEdit) return;
    const next = customItemsRef.current.filter(c => c.key !== key);
    customItemsRef.current = next;
    setCustomItems(next);
    void flushSave();
  }

  function deleteItem(id: string) {
    updateItems(itemsRef.current.filter(i => i.id !== id));
    setSelectedId(null);
  }

  function rotateItem(id: string) {
    updateItems(itemsRef.current.map(i =>
      i.id === id ? { ...i, rotation: (i.rotation + 90) % 360 } : i
    ));
  }

  function resizeItem(id: string, factor: number) {
    updateItems(itemsRef.current.map(i => {
      if (i.id !== id) return i;
      const wPct = Math.max(2, Math.min(80, +(i.wPct * factor).toFixed(2)));
      const hPct = Math.max(2, Math.min(80, +(i.hPct * factor).toFixed(2)));
      return { ...i, wPct, hPct };
    }));
  }

  // 写真（参考写真ギャラリー）
  async function handleUploadPhoto(file: File) {
    if (!canEdit) return;
    const verr = validateImageFile(file);
    if (verr) { setPhotoError(verr); return; }
    if (photosRef.current.length >= MAX_LAYOUT_PHOTOS) {
      setPhotoError(`写真は最大${MAX_LAYOUT_PHOTOS}枚までです`);
      return;
    }
    setUploading(true);
    setPhotoError(null);
    try {
      const photo = await uploadEventPhoto(eventIdRef.current, file);
      const next = [...photosRef.current, photo];
      photosRef.current = next;
      setPhotos(next);
      await flushSave();
    } catch (e) {
      console.error('layout photo upload error:', e);
      setPhotoError('アップロードに失敗しました。通信状況を確認してください。');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(photo: EventPhoto) {
    if (!canEdit) return;
    const next = photosRef.current.filter(p => p.id !== photo.id);
    photosRef.current = next;
    setPhotos(next);
    await flushSave();
    // Cloudinary 側の削除（認証が必要なため公開ビューでは失敗しうるが致命的ではない）
    deleteStoredPhoto(photo).catch(() => {});
  }

  // Drag
  function startDrag(e: React.MouseEvent | React.TouchEvent, id: string) {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const item = itemsRef.current.find(i => i.id === id);
    if (!item || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    draggingRef.current = {
      id,
      offX: cx - rect.left - (item.x / 100) * rect.width,
      offY: cy - rect.top  - (item.y / 100) * rect.height,
    };
  }

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const d = draggingRef.current;
      if (!d || !canvasRef.current) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const x = Math.max(0, Math.min(100, ((cx - rect.left - d.offX) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((cy - rect.top  - d.offY) / rect.height) * 100));
      const next = itemsRef.current.map(i => i.id === d.id ? { ...i, x, y } : i);
      itemsRef.current = next;
      setItems([...next]);
    }
    function onEnd() {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      if (canEdit) scheduleSave();
    }
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  function copyShareUrl() {
    const url = `${window.location.origin}/?layout=${eventId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function deleteLayout() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setConfirmDelete(false);
    try {
      await deleteDoc(doc(db, 'layouts', eventIdRef.current));
    } catch (err) {
      console.error('layout delete error:', err);
    }
    itemsRef.current = []; setItems([]);
    customItemsRef.current = []; setCustomItems([]);
    photosRef.current = []; setPhotos([]);
    setSelectedId(null);
    setLayoutExists(false);
  }

  const selectedItem = items.find(i => i.id === selectedId);
  const presentTypes = Array.from(new Set(items.map(i => i.type)));

  return (
    <div className="relative flex flex-col h-full bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        {isPublic && (
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs">EX</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">FLOOR LAYOUT</div>
          <div className="text-sm font-black text-white truncate">{eventName || 'レイアウト'}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && savedAt && !saving && (
            <span className="text-[10px] text-emerald-400 font-bold hidden sm:block">保存済み</span>
          )}
          {saving && <span className="text-[10px] text-amber-400 font-bold">保存中...</span>}
          {(canEdit || photos.length > 0) && (
            <button
              onClick={() => setShowPhotos(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
              title="参考写真"
            >
              <ImageIcon size={11} />
              <span>写真{photos.length > 0 ? ` (${photos.length})` : ''}</span>
            </button>
          )}
          {!isPublic && (
            <button
              onClick={copyShareUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'コピー済み' : 'URL共有'}</span>
            </button>
          )}
          {canEdit && !isPublic && layoutExists && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red-300 font-bold">削除?</span>
                <button onClick={deleteLayout} className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-black transition-colors">はい</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors">いいえ</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="このレイアウトを削除"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/35 text-red-300 rounded-xl text-xs font-bold transition-colors border border-red-400/20"
              >
                <Trash2 size={11} />
                <span className="hidden sm:inline">削除</span>
              </button>
            )
          )}
        </div>
      </div>

      <div className="layout-outer flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">
        {/* Palette */}
        {canEdit && (
          <div className="layout-palette shrink-0 border-b sm:border-b-0 sm:border-r border-white/10 bg-slate-800/60 p-3 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:w-[108px]">
            <div className="text-[9px] font-black text-white/30 uppercase tracking-widest shrink-0 self-center sm:self-auto hidden sm:block mb-1">追加</div>
            {Object.entries(CATALOG).map(([type, def]) => (
              <button
                key={type}
                onClick={() => addItem(type)}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all text-white shrink-0 min-w-[58px] sm:min-w-0 sm:w-full hover:bg-white/10 active:scale-95"
                style={{ borderColor: def.color + '50', background: def.color + '18' }}
                title={def.label + 'を追加'}
              >
                <span className="text-base leading-none">{def.emoji}</span>
                <span className="text-[9px] font-bold leading-tight text-center text-white/80">{def.label}</span>
              </button>
            ))}
            {customItems.map(ci => (
              <div key={ci.key} className="relative group shrink-0 min-w-[58px] sm:min-w-0 sm:w-full">
                <button
                  onClick={() => addItem(ci.key)}
                  className="w-full flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all text-white hover:bg-white/10 active:scale-95"
                  style={{ borderColor: ci.color + '50', background: ci.color + '18' }}
                  title={ci.label + 'を追加'}
                >
                  <span className="text-base leading-none">{ci.emoji}</span>
                  <span className="text-[9px] font-bold leading-tight text-center text-white/80 truncate w-full">{ci.label}</span>
                </button>
                <button
                  onClick={() => deleteCustomItem(ci.key)}
                  title={`${ci.label}（カスタム）を削除`}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-700 text-white/70 hover:text-red-300 hover:bg-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              onClick={addCustomItem}
              title="カスタムアイテムを追加"
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl border border-dashed border-white/25 text-white/70 hover:bg-white/10 hover:text-white shrink-0 min-w-[58px] sm:min-w-0 sm:w-full active:scale-95 transition-all"
            >
              <Plus size={16} />
              <span className="text-[9px] font-bold leading-tight text-center">カスタム</span>
            </button>
          </div>
        )}

        {/* Canvas wrapper */}
        <div className="flex-1 flex flex-col min-h-0 justify-center sm:justify-start p-4 gap-3 bg-slate-900/70 overflow-auto">
          {/* Canvas */}
          <div
            ref={canvasRef}
            className="relative rounded-2xl overflow-hidden w-full max-w-[960px] mx-auto shadow-2xl"
            style={{
              aspectRatio: '4/3',
              backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
              backgroundSize: '5% 5%',
              backgroundPosition: 'center',
              backgroundColor: '#f8fafc',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onClick={() => setSelectedId(null)}
          >
            {/* Room outline */}
            <div
              className="absolute rounded-xl border-2 border-dashed pointer-events-none"
              style={{ inset: '3%', borderColor: '#cbd5e1' }}
            />

            {items.map(item => {
              const isSel = item.id === selectedId;
              const def = defOf(item.type);
              const isCircle = item.type === 'round_table';
              const isSmall = item.type === 'pillar';
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.wPct}%`,
                    height: `${item.hPct}%`,
                    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                    backgroundColor: item.color,
                    borderRadius: isCircle ? '50%' : isSmall ? '4px' : '10px',
                    border: isSel ? '2.5px solid #60a5fa' : '1.5px solid rgba(255,255,255,0.25)',
                    boxShadow: isSel ? '0 0 0 3px rgba(96,165,250,0.35)' : '0 2px 8px rgba(0,0,0,0.22)',
                    cursor: canEdit ? (draggingRef.current?.id === item.id ? 'grabbing' : 'grab') : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '1px',
                    zIndex: isSel ? 20 : 5,
                    transition: draggingRef.current?.id === item.id ? 'none' : 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseDown={e => startDrag(e, item.id)}
                  onTouchStart={e => startDrag(e, item.id)}
                  onClick={e => { e.stopPropagation(); setSelectedId(item.id); }}
                >
                  {!isSmall && (
                    <span style={{ fontSize: '1em', lineHeight: 1, pointerEvents: 'none' }}>
                      {item.emoji ?? def?.emoji ?? '📦'}
                    </span>
                  )}
                  <span style={{
                    fontSize: isSmall ? '0.45em' : '0.5em',
                    fontWeight: 900,
                    color: 'white',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    lineHeight: 1.1,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}>
                    {item.label}
                  </span>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-slate-400">
                  <div className="text-4xl mb-3">🗺️</div>
                  <div className="text-sm font-bold">
                    {canEdit ? '左のパレットからアイテムを追加' : 'レイアウトはまだありません'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected item toolbar */}
          <AnimatePresence>
            {selectedItem && canEdit && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-center gap-2 flex-wrap"
              >
                <span
                  className="text-xs font-black px-3 py-1.5 rounded-xl"
                  style={{ background: selectedItem.color + '30', color: selectedItem.color, border: `1px solid ${selectedItem.color}40` }}
                >
                  {selectedItem.label}
                </span>
                <button
                  onClick={() => resizeItem(selectedItem.id, 1.15)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
                >
                  <Maximize2 size={12} />
                  大きく
                </button>
                <button
                  onClick={() => resizeItem(selectedItem.id, 1 / 1.15)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
                >
                  <Minimize2 size={12} />
                  小さく
                </button>
                <button
                  onClick={() => rotateItem(selectedItem.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
                >
                  <RotateCw size={12} />
                  回転
                </button>
                <button
                  onClick={() => deleteItem(selectedItem.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/35 text-red-300 rounded-xl text-xs font-bold transition-colors border border-red-400/20"
                >
                  <Trash2 size={12} />
                  削除
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend (read-only or public) */}
          {(!canEdit || isPublic) && presentTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {presentTypes.map(type => {
                const def = defOf(type);
                if (!def) return null;
                return (
                  <div key={type} className="flex items-center gap-1.5 text-[10px] text-white/60">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: def.color }} />
                    {def.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* モバイル(縦向き)用の操作ヒント */}
          {canEdit && (
            <div className="sm:hidden mt-1 text-center text-[11px] text-white/45 leading-relaxed">
              アイテムをドラッグで移動・タップで選択<br />
              📱 横向きにすると編集エリアが広がります
            </div>
          )}
        </div>
      </div>

      {/* 参考写真ギャラリー（オーバーレイ） */}
      <AnimatePresence>
        {showPhotos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 bg-slate-900/95 backdrop-blur-sm flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div className="text-sm font-black text-white">参考写真（{photos.length}/{MAX_LAYOUT_PHOTOS}）</div>
              <button
                onClick={() => { setShowPhotos(false); setPhotoError(null); }}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {canEdit && photos.length < MAX_LAYOUT_PHOTOS && (
                <label className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed border-white/20 text-white/70 text-sm font-bold cursor-pointer hover:border-indigo-400 hover:text-white hover:bg-white/5 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void handleUploadPhoto(f); e.currentTarget.value = ''; }}
                  />
                  <Upload size={16} />
                  {uploading ? 'アップロード中...' : '写真を追加（最大10MB）'}
                </label>
              )}
              {photoError && (
                <p className="text-xs text-red-300 font-bold text-center">{photoError}</p>
              )}
              {photos.length === 0 ? (
                <div className="text-center py-16 text-white/40">
                  <ImageIcon size={32} className="mx-auto mb-3 opacity-50" />
                  <div className="text-sm">{canEdit ? '会場図や現地写真を追加できます' : '写真はまだありません'}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map(p => (
                    <div key={p.id} className="relative group rounded-xl overflow-hidden border border-white/10 bg-slate-800">
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        <img src={p.thumbnailUrl || p.url} alt={p.caption || ''} className="w-full h-32 object-cover" loading="lazy" />
                      </a>
                      {canEdit && (
                        <button
                          onClick={() => handleDeletePhoto(p)}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/55 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          title="削除"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Public wrapper (no auth) ─────────────────────────────────────────────────

export function LayoutPublicView({ eventId }: { eventId: string }) {
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    // Try to get cached eventName from layouts collection
    getDoc(doc(db, 'layouts', eventId))
      .then(snap => { if (snap.exists()) setEventName((snap.data() as { eventName?: string }).eventName ?? ''); })
      .catch(() => {});
  }, [eventId]);

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <LayoutCanvas eventId={eventId} eventName={eventName} canEdit isPublic />
    </div>
  );
}

// ─── Admin view (event selector) ─────────────────────────────────────────────

interface AdminProps {
  events: Event[];
  canEdit: boolean;
}

function fmtDateRange(start: string, end: string) {
  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    const dow = ['日','月','火','水','木','金','土'][dt.getDay()];
    return `${dt.getMonth()+1}/${dt.getDate()}(${dow})`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} → ${fmt(end)}`;
}

export default function LayoutView({ events, canEdit }: AdminProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Filter aquarium events (and all events for layout purposes)
  const eventList = [...events]
    .filter(e => e.status !== 'cancelled')
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  const selectedEvent = eventList.find(e => e.id === selectedEventId);

  if (selectedEvent) {
    return (
      <div className="relative flex flex-col" style={{ height: '100%' }}>
          <div className="relative z-10 flex flex-col" style={{ height: '100%' }}>
          {/* Back button */}
          <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-white/10">
            <button
              onClick={() => setSelectedEventId(null)}
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-bold transition-colors"
            >
              <ChevronRight size={14} className="rotate-180" />
              イベント一覧
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <LayoutCanvas
              eventId={selectedEvent.id}
              eventName={selectedEvent.venue}
              canEdit={canEdit}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-full">

      <div className="relative z-10 px-4 py-6 pb-32 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">LAYOUT PLANNER</div>
          <h2 className="text-2xl font-black text-white">レイアウト</h2>
          <p className="text-xs text-white/50 mt-1">クライアントと共有できるフロアプランを作成します</p>
        </div>

        {eventList.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <LayoutGrid size={32} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm">イベントがありません</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {eventList.map(ev => (
              <motion.button
                key={ev.id}
                whileHover={{ y: -2 }}
                onClick={() => setSelectedEventId(ev.id)}
                className="w-full text-left bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:bg-white transition-all group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <LayoutGrid size={16} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-800 truncate">{ev.venue}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {ev.start ? fmtDateRange(ev.start, ev.end || ev.start) : '日程未定'}
                    {ev.client ? ` · ${ev.client}` : ''}
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
