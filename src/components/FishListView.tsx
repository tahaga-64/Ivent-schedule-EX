import {
  useState, useEffect, useMemo, useCallback, useRef,
  forwardRef, useImperativeHandle,
} from 'react';
import { useRegisterUnsavedGuard, useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { db } from '../lib/firebase';
import {
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import type { Event, FishItem } from '../types';
import {
  Fish, Plus, Trash2, GripVertical, Download, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notifyPush, isPushNotificationConfigured } from '../lib/pushNotifications';
import { fmtDateJPFull } from '../lib/eventHelpers';

interface Props {
  events: Event[];
  canEdit: boolean;
  isActive?: boolean;
  initialEventId?: string | null;
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00');
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  if (!end || start === end) return `${sm}/${sd}`;
  const e = new Date(end + 'T00:00:00');
  return `${sm}/${sd}〜${e.getMonth() + 1}/${e.getDate()}`;
}

function isEventPast(ev: Event): boolean {
  const today = new Date().toISOString().split('T')[0];
  const endDate = ev.end || ev.start;
  return !!endDate && endDate < today;
}

// ── PC spreadsheet components ─────────────────────────────────────────────────

interface SpreadsheetRowRef {
  focusName: () => void;
  focusCount: () => void;
  focusNote: () => void;
}

interface SpreadsheetRowProps {
  item: FishItem;
  index: number;
  canEdit: boolean;
  onNameSave: (id: string, name: string) => void;
  onCountChange: (item: FishItem, count: number) => void;
  onNoteSave: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (dir: 'tab' | 'shift-tab' | 'up' | 'down', col: 'name' | 'count' | 'note') => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragOver: boolean;
}

const SpreadsheetRow = forwardRef<SpreadsheetRowRef, SpreadsheetRowProps>(
  function SpreadsheetRow(
    { item, index, canEdit, onNameSave, onCountChange, onNoteSave, onDelete, onNavigate, onDragStart, onDragOver, onDrop, isDragOver },
    ref,
  ) {
    const [name, setName] = useState(item.name);
    const [note, setNote] = useState(item.note ?? '');
    const nameRef = useRef<HTMLInputElement>(null);
    const countRef = useRef<HTMLInputElement>(null);
    const noteRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setName(item.name); }, [item.name]);
    useEffect(() => { setNote(item.note ?? ''); }, [item.note]);

    useImperativeHandle(ref, () => ({
      focusName: () => nameRef.current?.focus(),
      focusCount: () => countRef.current?.focus(),
      focusNote: () => noteRef.current?.focus(),
    }));

    const cellCls = 'w-full px-2 py-1 text-sm bg-transparent border border-transparent rounded-lg focus:border-indigo-300 focus:bg-white focus:outline-none transition-all';

    function handleTabKey(e: React.KeyboardEvent, col: 'name' | 'count' | 'note') {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      onNavigate(e.shiftKey ? 'shift-tab' : 'tab', col);
    }

    function handleArrowKey(e: React.KeyboardEvent, col: 'name' | 'count' | 'note') {
      if (e.key === 'ArrowDown') { e.preventDefault(); onNavigate('down', col); }
      if (e.key === 'ArrowUp') { e.preventDefault(); onNavigate('up', col); }
    }

    return (
      <tr
        className={`group border-b transition-colors ${
          isDragOver ? 'bg-indigo-100 border-b-indigo-400' : 'border-slate-100 hover:bg-indigo-50/20'
        }`}
        draggable={canEdit}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {canEdit && (
          <td className="pl-2 pr-0 py-0.5 w-7 cursor-grab active:cursor-grabbing">
            <GripVertical size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
          </td>
        )}
        <td className="px-3 py-0.5 text-[11px] text-slate-300 tabular-nums select-none w-10 text-right shrink-0">
          {index + 1}
        </td>
        <td className="px-1 py-0.5">
          {canEdit ? (
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => { const t = name.trim(); if (t && t !== item.name) onNameSave(item.id, t); else setName(item.name); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); countRef.current?.focus(); return; }
                handleTabKey(e, 'name');
                handleArrowKey(e, 'name');
              }}
              className={`${cellCls} font-medium text-slate-900`}
            />
          ) : (
            <span className="px-2 py-1 text-sm font-medium text-slate-900">{item.name}</span>
          )}
        </td>
        <td className="px-1 py-0.5 w-28">
          <div className="flex items-center gap-0.5">
            {canEdit ? (
              <input
                ref={countRef}
                type="number"
                min={0}
                value={item.count}
                onChange={e => onCountChange(item, Number(e.target.value))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); noteRef.current?.focus(); return; }
                  handleTabKey(e, 'count');
                  handleArrowKey(e, 'count');
                }}
                className={`${cellCls} w-16 text-center font-black tabular-nums text-slate-900`}
              />
            ) : (
              <span className="px-2 py-1 text-sm font-black tabular-nums text-slate-900">{item.count}</span>
            )}
            <span className="text-xs text-slate-400 shrink-0">匹</span>
          </div>
        </td>
        <td className="px-1 py-0.5">
          {canEdit ? (
            <input
              ref={noteRef}
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={() => { if (note !== (item.note ?? '')) onNoteSave(item.id, note); }}
              placeholder="メモ"
              onKeyDown={e => {
                handleTabKey(e, 'note');
                handleArrowKey(e, 'note');
              }}
              className={`${cellCls} text-slate-500 placeholder-slate-300`}
            />
          ) : (
            <span className="px-2 py-1 text-sm text-slate-500">{item.note}</span>
          )}
        </td>
        {canEdit && (
          <td className="px-2 py-0.5 w-12">
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="削除"
            >
              <Trash2 size={13} />
            </button>
          </td>
        )}
      </tr>
    );
  }
);

interface NewSpreadsheetRowRef {
  focusName: () => void;
}

interface NewSpreadsheetRowProps {
  onAdd: (name: string, count: number, note: string) => Promise<void>;
  disabled?: boolean;
  onShiftTabFromName?: () => void;
}

const NewSpreadsheetRow = forwardRef<NewSpreadsheetRowRef, NewSpreadsheetRowProps>(
  function NewSpreadsheetRow({ onAdd, disabled, onShiftTabFromName }, ref) {
    const [name, setName] = useState('');
    const [count, setCount] = useState(1);
    const [note, setNote] = useState('');
    const nameRef = useRef<HTMLInputElement>(null);
    const countRef = useRef<HTMLInputElement>(null);
    const noteRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focusName: () => nameRef.current?.focus(),
    }));

    const doAdd = async () => {
      if (!name.trim()) return;
      await onAdd(name.trim(), count, note.trim());
      setName(''); setCount(1); setNote('');
      setTimeout(() => nameRef.current?.focus(), 30);
    };

    const cellCls = 'w-full px-2 py-1 text-sm bg-transparent border border-transparent rounded-lg focus:border-indigo-300 focus:bg-white focus:outline-none transition-all placeholder-slate-300';

    return (
      <tr className="border-b border-dashed border-slate-100 bg-slate-50/30">
        <td className="pl-2 pr-0 py-1 w-7" />
        <td className="px-3 py-1 text-[11px] text-slate-300 select-none text-right w-10">
          <Plus size={11} className="ml-auto" />
        </td>
        <td className="px-1 py-1">
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); countRef.current?.focus(); return; }
              if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); countRef.current?.focus(); return; }
              if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); onShiftTabFromName?.(); return; }
            }}
            placeholder="新しい魚を追加..."
            disabled={disabled}
            className={`${cellCls} text-slate-700`}
          />
        </td>
        <td className="px-1 py-1 w-28">
          <div className="flex items-center gap-0.5">
            <input
              ref={countRef}
              type="number"
              min={0}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); noteRef.current?.focus(); return; }
                if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); noteRef.current?.focus(); return; }
                if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); nameRef.current?.focus(); return; }
              }}
              disabled={disabled}
              className={`${cellCls} w-16 text-center font-black tabular-nums text-slate-700`}
            />
            <span className="text-xs text-slate-400 shrink-0">匹</span>
          </div>
        </td>
        <td className="px-1 py-1">
          <input
            ref={noteRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); doAdd(); return; }
              if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); doAdd(); return; }
              if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); countRef.current?.focus(); return; }
            }}
            placeholder="メモ（任意）"
            disabled={disabled}
            className={`${cellCls} text-slate-500`}
          />
        </td>
        <td className="px-2 py-1 w-12">
          <button
            onClick={doAdd}
            disabled={!name.trim() || disabled}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-black transition-colors"
          >
            <Plus size={11} />
            追加
          </button>
        </td>
      </tr>
    );
  }
);

// ── Main component ────────────────────────────────────────────────────────────

type SortKey = 'default' | 'name' | 'count';

export default function FishListView({ events, canEdit, isActive = true, initialEventId }: Props) {
  const aquariumEvents = useMemo(
    () => events
      .filter(ev => ev.type === '水族館' && ev.status !== 'cancelled' && !isEventPast(ev))
      .sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    [events]
  );

  const [selectedEventId, setSelectedEventId] = useState<string>(
    () => (initialEventId && aquariumEvents.some(e => e.id === initialEventId) ? initialEventId : aquariumEvents[0]?.id) ?? ''
  );
  const [fishItems, setFishItems] = useState<FishItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState<number>(1);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { runWithGuard } = useUnsavedChanges();

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Drag-and-drop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // Row refs for keyboard navigation
  const rowRefs = useRef<(SpreadsheetRowRef | null)[]>([]);
  const newRowRef = useRef<NewSpreadsheetRowRef | null>(null);

  const selectedEvent = aquariumEvents.find(ev => ev.id === selectedEventId);

  const totalFishCount = useMemo(
    () => fishItems.reduce((sum, item) => sum + (Number.isFinite(item.count) ? item.count : 0), 0),
    [fishItems],
  );

  const hasDraft = useMemo(
    () => !!(newName.trim() || newNote.trim() || newCount !== 1),
    [newName, newNote, newCount]
  );

  const clearDraft = useCallback(() => {
    setNewName('');
    setNewCount(1);
    setNewNote('');
    setError(null);
  }, []);

  // Sorted items for display
  const sortedItems = useMemo(() => {
    if (sortKey === 'default') return fishItems;
    const copy = [...fishItems];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'ja');
      if (sortKey === 'count') cmp = a.count - b.count;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [fishItems, sortKey, sortDir]);

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={11} className="opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  }

  const notifyFishAdded = useCallback((name: string, count: number) => {
    if (!selectedEvent || !isPushNotificationConfigured()) return;
    const head = [selectedEvent.venue, fmtDateJPFull(selectedEvent.start)]
      .map(p => (p ?? '').trim())
      .filter(Boolean)
      .join(' / ');
    notifyPush({
      type: 'fish_added',
      title: '魚リストに追加されました',
      message: [head, `${name} ${count}匹`].filter(Boolean).join(' ・ '),
      eventId: selectedEvent.id,
    });
  }, [selectedEvent]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!newName.trim() || !selectedEventId) {
      clearDraft();
      return true;
    }
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const trimmedNote = newNote.trim();
      const item: FishItem = {
        id,
        name: newName.trim(),
        count: Number.isFinite(newCount) ? newCount : 0,
        order: fishItems.length,
      };
      if (trimmedNote) item.note = trimmedNote;
      await setDoc(doc(db, 'events', selectedEventId, 'fishItems', id), item);
      notifyFishAdded(item.name, item.count);
      clearDraft();
      return true;
    } catch (err) {
      console.error('fishItems add error:', err);
      setError('保存に失敗しました。権限またはネットワークを確認してください。');
      return false;
    } finally {
      setSaving(false);
    }
  }, [newName, newNote, newCount, selectedEventId, fishItems.length, clearDraft, notifyFishAdded]);

  useRegisterUnsavedGuard(`fish-draft-${selectedEventId}`, {
    enabled: canEdit && !!selectedEventId,
    hasUnsaved: hasDraft,
    save: saveDraft,
    discard: clearDraft,
  });

  useEffect(() => {
    if (aquariumEvents.length === 0) {
      setSelectedEventId('');
      return;
    }
    if (!aquariumEvents.some(ev => ev.id === selectedEventId)) {
      setSelectedEventId(aquariumEvents[0].id);
    }
  }, [aquariumEvents, selectedEventId]);

  useEffect(() => {
    if (!isActive || !selectedEventId) return;
    const unsub = onSnapshot(
      collection(db, 'events', selectedEventId, 'fishItems'),
      snap => {
        const items: FishItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FishItem));
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setFishItems(items);
      },
      err => console.error('fishItems snapshot error:', err)
    );
    return unsub;
  }, [isActive, selectedEventId]);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  function makeNavigationHandler(rowIdx: number) {
    return (dir: 'tab' | 'shift-tab' | 'up' | 'down', col: 'name' | 'count' | 'note') => {
      const cols = ['name', 'count', 'note'] as const;
      const colIdx = cols.indexOf(col);
      const focusMethods = ['focusName', 'focusCount', 'focusNote'] as const;

      if (dir === 'tab') {
        if (colIdx < 2) {
          rowRefs.current[rowIdx]?.[focusMethods[colIdx + 1]]();
        } else if (rowIdx + 1 < sortedItems.length) {
          rowRefs.current[rowIdx + 1]?.focusName();
        } else {
          newRowRef.current?.focusName();
        }
      } else if (dir === 'shift-tab') {
        if (colIdx > 0) {
          rowRefs.current[rowIdx]?.[focusMethods[colIdx - 1]]();
        } else if (rowIdx > 0) {
          rowRefs.current[rowIdx - 1]?.focusNote();
        }
      } else if (dir === 'up' && rowIdx > 0) {
        rowRefs.current[rowIdx - 1]?.[focusMethods[colIdx]]();
      } else if (dir === 'down') {
        if (rowIdx + 1 < sortedItems.length) {
          rowRefs.current[rowIdx + 1]?.[focusMethods[colIdx]]();
        } else {
          newRowRef.current?.focusName();
        }
      }
    };
  }

  // ── Data mutation handlers ─────────────────────────────────────────────────

  async function handleAdd() {
    if (!newName.trim() || !selectedEventId) return;
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const trimmedNote = newNote.trim();
      const item: FishItem = {
        id,
        name: newName.trim(),
        count: Number.isFinite(newCount) ? newCount : 0,
        order: fishItems.length,
      };
      if (trimmedNote) item.note = trimmedNote;
      await setDoc(doc(db, 'events', selectedEventId, 'fishItems', id), item);
      notifyFishAdded(item.name, item.count);
      setNewName('');
      setNewCount(1);
      setNewNote('');
    } catch (err) {
      console.error('fishItems add error:', err);
      setError('保存に失敗しました。権限またはネットワークを確認してください。');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItem(name: string, count: number, note: string) {
    if (!name.trim() || !selectedEventId) return;
    try {
      const id = crypto.randomUUID();
      const item: FishItem = {
        id,
        name: name.trim(),
        count: Number.isFinite(count) ? count : 0,
        order: fishItems.length,
      };
      if (note.trim()) item.note = note.trim();
      await setDoc(doc(db, 'events', selectedEventId, 'fishItems', id), item);
      notifyFishAdded(item.name, item.count);
    } catch (err) {
      console.error('fishItems add error:', err);
      setError('保存に失敗しました。権限またはネットワークを確認してください。');
    }
  }

  async function handleDelete(itemId: string) {
    if (!selectedEventId) return;
    try {
      await deleteDoc(doc(db, 'events', selectedEventId, 'fishItems', itemId));
    } catch (err) {
      console.error('fishItems delete error:', err);
    }
  }

  async function handleCountChange(item: FishItem, count: number) {
    if (!selectedEventId) return;
    const safeCount = Number.isFinite(count) ? count : 0;
    try {
      await updateDoc(doc(db, 'events', selectedEventId, 'fishItems', item.id), { count: safeCount });
    } catch (err) {
      console.error('fishItems update error:', err);
    }
  }

  async function handleNameSave(itemId: string, name: string) {
    if (!selectedEventId || !name.trim()) return;
    try {
      await updateDoc(doc(db, 'events', selectedEventId, 'fishItems', itemId), { name: name.trim() });
    } catch (err) {
      console.error('fishItems name update error:', err);
    }
  }

  async function handleNoteSave(itemId: string, note: string) {
    if (!selectedEventId) return;
    try {
      await updateDoc(doc(db, 'events', selectedEventId, 'fishItems', itemId), { note: note });
    } catch (err) {
      console.error('fishItems note update error:', err);
    }
  }

  // ── Drag-and-drop reorder ─────────────────────────────────────────────────

  async function handleDrop(dropIndex: number) {
    if (dragIdx === null || dragIdx === dropIndex || !selectedEventId) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }
    const newItems = [...sortedItems];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(dropIndex, 0, moved);

    // Reset sort to default when manually reordering
    setSortKey('default');

    const batch = writeBatch(db);
    newItems.forEach((item, i) => {
      batch.update(doc(db, 'events', selectedEventId, 'fishItems', item.id), { order: i });
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error('fishItems reorder error:', err);
    }
    setDragIdx(null);
    setDropIdx(null);
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  function handleExportCSV() {
    const rows: string[][] = [['#', '魚の名前', '匹数', 'メモ']];
    sortedItems.forEach((item, i) => {
      rows.push([(i + 1).toString(), item.name, item.count.toString(), item.note ?? '']);
    });
    const csv = rows
      .map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `魚リスト_${selectedEvent?.venue ?? 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg-app)' }}>
      <div className="relative z-10 w-full max-w-none px-4 md:px-6 lg:px-8 py-6 pb-28 md:pb-8">

        {aquariumEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
            <Fish size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">水族館イベントがありません</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-500">AQUARIUM</div>
              <h2 className="text-2xl font-black text-slate-900">魚リスト</h2>
            </div>

            {/* イベント選択 */}
            <div className="mb-6">
              {aquariumEvents.length === 1 ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <Fish size={15} className="shrink-0 text-slate-400" />
                  <span className="text-sm font-black text-slate-900">{aquariumEvents[0].venue}</span>
                  {aquariumEvents[0].start && (
                    <span className="ml-auto text-xs text-slate-500 shrink-0">
                      {fmtDateRange(aquariumEvents[0].start, aquariumEvents[0].end || aquariumEvents[0].start)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl p-1 bg-white border border-slate-200 shadow-sm">
                  <div className="flex gap-1 overflow-x-auto p-1 scrollbar-hide">
                    {aquariumEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => runWithGuard(() => setSelectedEventId(ev.id))}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          selectedEventId === ev.id
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Fish size={12} />
                        <span>{ev.venue}</span>
                        {ev.start && (
                          <span className={`text-[10px] ${selectedEventId === ev.id ? 'text-slate-300' : 'text-slate-400'}`}>
                            {fmtDateRange(ev.start, ev.end || ev.start)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedEvent && (
              <>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-800 font-bold">
                    {error}
                  </div>
                )}

                {/* PC: スプレッドシートテーブル */}
                <div className="hidden md:block rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Fish size={14} className="text-slate-400" />
                      <span className="text-sm font-black text-slate-900">{selectedEvent.venue}</span>
                      {selectedEvent.start && (
                        <span className="text-xs text-slate-400">
                          {fmtDateRange(selectedEvent.start, selectedEvent.end || selectedEvent.start)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {fishItems.length > 0 && (
                        <span className="text-xs font-black text-slate-500 tabular-nums">
                          {fishItems.length}種 / 合計 {totalFishCount}匹
                        </span>
                      )}
                      {fishItems.length > 0 && (
                        <button
                          onClick={handleExportCSV}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold transition-colors"
                          title="CSVでダウンロード"
                        >
                          <Download size={12} />
                          CSV
                        </button>
                      )}
                    </div>
                  </div>

                  {/* テーブル（スティッキーヘッダー付き） */}
                  <div
                    className="overflow-auto"
                    style={{ maxHeight: 'calc(100vh - 280px)' }}
                    onDragOver={e => e.preventDefault()}
                  >
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="border-b border-slate-200 bg-slate-50">
                          {canEdit && <th className="w-7" />}
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-10">#</th>
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                            <button
                              className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                              onClick={() => handleSortClick('name')}
                            >
                              魚の名前 <SortIcon col="name" />
                            </button>
                          </th>
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left w-28">
                            <button
                              className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                              onClick={() => handleSortClick('count')}
                            >
                              匹数 <SortIcon col="count" />
                            </button>
                          </th>
                          <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">メモ</th>
                          {canEdit && <th className="w-12" />}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedItems.length === 0 && !canEdit && (
                          <tr>
                            <td colSpan={canEdit ? 6 : 4} className="px-4 py-12 text-center text-sm text-slate-400">
                              <Fish size={28} className="mx-auto mb-2 opacity-30" />
                              観賞魚が登録されていません
                            </td>
                          </tr>
                        )}
                        {sortedItems.map((item, index) => (
                          <SpreadsheetRow
                            key={item.id}
                            ref={el => { rowRefs.current[index] = el; }}
                            item={item}
                            index={index}
                            canEdit={canEdit}
                            onNameSave={handleNameSave}
                            onCountChange={handleCountChange}
                            onNoteSave={handleNoteSave}
                            onDelete={handleDelete}
                            onNavigate={makeNavigationHandler(index)}
                            onDragStart={() => setDragIdx(index)}
                            onDragOver={e => { e.preventDefault(); setDropIdx(index); }}
                            onDrop={() => handleDrop(index)}
                            isDragOver={dropIdx === index && dragIdx !== index}
                          />
                        ))}
                        {canEdit && (
                          <NewSpreadsheetRow
                            ref={newRowRef}
                            onAdd={handleAddItem}
                            disabled={saving}
                            onShiftTabFromName={() => {
                              if (sortedItems.length > 0) {
                                rowRefs.current[sortedItems.length - 1]?.focusNote();
                              }
                            }}
                          />
                        )}
                      </tbody>
                      {sortedItems.length > 0 && (
                        <tfoot>
                          <tr className="border-t border-slate-100 bg-slate-50/50 sticky bottom-0">
                            <td colSpan={canEdit ? 6 : 4} className="px-4 py-2 text-right text-xs font-black text-slate-500 tabular-nums">
                              {sortedItems.length}種 / 合計 {totalFishCount}匹
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* モバイル: カードグリッド */}
                <div className="block md:hidden">
                  <div className="md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:gap-6 xl:gap-8 md:items-start">
                    <div className="space-y-4">
                      {fishItems.length > 0 && (
                        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white border border-slate-200 shadow-sm">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-50">
                            <Fish size={18} className="text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-slate-900 text-sm truncate">{selectedEvent.venue}</div>
                            <div className="text-xs text-slate-500">
                              {selectedEvent.start ? fmtDateRange(selectedEvent.start, selectedEvent.end || selectedEvent.start) : '日程未定'}
                            </div>
                          </div>
                          <span className="ml-auto shrink-0 text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                            {fishItems.length}種 / {totalFishCount}匹
                          </span>
                        </div>
                      )}

                      {canEdit && (
                        <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm">
                          <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">観賞魚を追加</div>
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="魚の名前（例：ネオンテトラ）"
                              value={newName}
                              onChange={e => { setNewName(e.target.value); setError(null); }}
                              onKeyDown={e => e.key === 'Enter' && handleAdd()}
                              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                            <div className="flex gap-2 overflow-hidden">
                              <input
                                type="number"
                                min={0}
                                value={newCount}
                                onChange={e => setNewCount(Number(e.target.value))}
                                className="w-24 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                              <span className="flex items-center text-sm text-slate-500 shrink-0">匹</span>
                              <input
                                type="text"
                                placeholder="メモ（任意）"
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </div>
                            <button
                              onClick={handleAdd}
                              disabled={!newName.trim() || saving}
                              className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-sm py-2.5 transition-colors"
                            >
                              <Plus size={14} />
                              {saving ? '追加中...' : '追加'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 mt-4">
                      {fishItems.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                          <Fish size={32} className="mx-auto mb-3 opacity-50" />
                          <div className="text-sm">観賞魚が登録されていません</div>
                          {canEdit && <div className="text-xs mt-1 text-slate-400">フォームから追加してください</div>}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                          <AnimatePresence initial={false}>
                            {fishItems.map((item, index) => (
                              <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="rounded-2xl p-4 transition-colors group relative bg-white border border-slate-200 hover:border-slate-300 shadow-sm"
                              >
                                <div className="absolute top-2.5 left-3 text-[10px] font-black text-slate-300 tabular-nums">
                                  #{index + 1}
                                </div>
                                {canEdit && (
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    aria-label={`${item.name}を削除`}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                <div className="mt-3 mb-2">
                                  <div className="font-black text-sm text-slate-900 leading-snug pr-4">{item.name}</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {canEdit ? (
                                    <>
                                      <input
                                        type="number"
                                        min={0}
                                        value={item.count}
                                        onChange={e => handleCountChange(item, Number(e.target.value))}
                                        aria-label={`${item.name}の匹数`}
                                        className="w-16 text-center rounded-lg border border-slate-200 px-2 py-1 text-xs font-black tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                      />
                                      <span className="text-xs text-slate-500">匹</span>
                                    </>
                                  ) : (
                                    <span className="font-bold tabular-nums text-sm text-slate-900">{item.count}<span className="text-xs text-slate-500 ml-0.5">匹</span></span>
                                  )}
                                </div>
                                {item.note && (
                                  <div className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1 leading-snug">
                                    {item.note}
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
