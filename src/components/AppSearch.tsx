import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Search, Calendar, Home, ClipboardList, Archive, Package, Fish, LayoutGrid, Images, CalendarDays } from 'lucide-react';
import { Event } from '../types';
import {
  type AppViewMode,
  matchFeatures,
  searchEvents,
  formatEventSearchSubtitle,
} from '../lib/appSearch';

type ResultItem =
  | { kind: 'feature'; id: AppViewMode; label: string }
  | { kind: 'event'; event: Event };

function featureIcon(id: AppViewMode) {
  switch (id) {
    case 'home': return <Home size={16} />;
    case 'calendar': return <Calendar size={16} />;
    case 'prep': return <ClipboardList size={16} />;
    case 'schedule': return <CalendarDays size={16} />;
    case 'fish': return <Fish size={16} />;
    case 'master': return <Package size={16} />;
    case 'layout': return <LayoutGrid size={16} />;
    case 'album': return <Images size={16} />;
    case 'archive': return <Archive size={16} />;
    default: return <Search size={16} />;
  }
}

interface AppSearchProps {
  searchQuery: string;
  events: Event[];
  onSearchChange: (q: string) => void;
  onSetView: (v: AppViewMode) => void;
  onSelectEvent: (ev: Event) => void;
}

export default function AppSearch({
  searchQuery,
  events,
  onSearchChange,
  onSetView,
  onSelectEvent,
}: AppSearchProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const features = matchFeatures(searchQuery, 5);
  const eventResults = searchEvents(events, searchQuery, 8);
  const hasQuery = searchQuery.trim().length > 0;

  const results: ResultItem[] = [
    ...features.map(f => ({ kind: 'feature' as const, id: f.id, label: f.label })),
    ...eventResults.map(event => ({ kind: 'event' as const, event })),
  ];

  const showDropdown = open && hasQuery && results.length > 0;

  const pick = useCallback((item: ResultItem) => {
    if (item.kind === 'feature') {
      onSetView(item.id);
    } else {
      onSelectEvent(item.event);
    }
    onSearchChange('');
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.blur();
  }, [onSetView, onSelectEvent, onSearchChange]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Escape') {
        onSearchChange('');
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  let featureIdx = 0;
  let eventIdx = 0;

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 shadow-sm">
        <Search size={16} className="text-slate-500 shrink-0" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onKeyDown={onInputKeyDown}
          placeholder="会場・クライアント・機能を検索…"
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
        />
        <kbd className="hidden md:inline-flex shrink-0 text-[10px] text-slate-500 font-medium bg-white border border-slate-200 px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[min(70vh,420px)] overflow-y-auto"
        >
          {features.length > 0 && (
            <div>
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0 bg-white">
                機能へ移動
              </div>
              {features.map(f => {
                const idx = featureIdx++;
                const active = idx === activeIndex;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick({ kind: 'feature', id: f.id, label: f.label })}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="shrink-0 text-indigo-600">{featureIcon(f.id)}</span>
                    <span className="text-sm font-bold">{f.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {eventResults.length > 0 && (
            <div className={features.length > 0 ? 'border-t border-slate-200' : ''}>
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0 bg-white">
                イベント
              </div>
              {eventResults.map(ev => {
                const idx = features.length + eventIdx++;
                const active = idx === activeIndex;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick({ kind: 'event', event: ev })}
                    className={`w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-bold truncate w-full">{ev.venue}</span>
                    <span className="text-[11px] text-slate-500 truncate w-full">
                      {formatEventSearchSubtitle(ev)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {open && hasQuery && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 text-center shadow-lg">
          一致する機能・イベントがありません
        </div>
      )}
    </div>
  );
}
