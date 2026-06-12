/**
 * ContainerBoxView — コンテナボックス
 * イベントに持っていく備品を計算・確認するツール（現状は骨組みのみ）。
 */
import { useState, useMemo } from 'react';
import type { Event } from '../types';
import { Boxes, ChevronRight, Construction } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  events: Event[];
  canEdit: boolean;
}

function fmtDateRange(start?: string, end?: string) {
  if (!start) return '';
  const s = new Date(start + 'T00:00:00');
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  if (!end || start === end) return `${sm}/${sd}`;
  const e = new Date(end + 'T00:00:00');
  return `${sm}/${sd}〜${e.getMonth() + 1}/${e.getDate()}`;
}

export default function ContainerBoxView({ events }: Props) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const active = useMemo(
    () => [...events]
      .filter(e => e.status !== 'cancelled')
      .filter(e => !(e.end && e.end < today))
      .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999')),
    [events, today],
  );

  const selectedEvent = active.find(e => e.id === selectedEventId);

  // 詳細（イベント選択後）— 計算ツール本体はこれから実装
  if (selectedEvent) {
    return (
      <div className="relative flex flex-col min-h-full bg-[var(--bg-app)]">
        <div className="relative z-10 flex flex-col" style={{ height: '100%' }}>
          {/* 戻る */}
          <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-slate-200 bg-white">
            <button
              onClick={() => setSelectedEventId(null)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs font-bold transition-colors"
            >
              <ChevronRight size={14} className="rotate-180" />
              イベント一覧
            </button>
          </div>

          <div className="px-4 md:px-6 lg:px-8 py-6 w-full max-w-none">
            <div className="mb-6">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">CONTAINER BOX</div>
              <h2 className="text-2xl font-black text-slate-900">{selectedEvent.venue}</h2>
              <p className="text-xs text-slate-500 mt-1 font-mono">{fmtDateRange(selectedEvent.start, selectedEvent.end)}</p>
            </div>

            {/* プレースホルダー（計算ツールはこれから実装） */}
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 flex flex-col items-center justify-center text-center">
              <Construction size={36} className="text-slate-300 mb-3" />
              <p className="text-sm font-black text-slate-600">コンテナボックス計算ツールは準備中です</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                このイベントに持っていく備品の数量や積載を<br />計算・確認できるようにする予定です。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 一覧（イベント選択）
  return (
    <div className="relative flex flex-col min-h-full bg-[var(--bg-app)]">
      <div className="relative z-10 px-4 md:px-6 lg:px-8 py-6 pb-32 md:pb-8 w-full max-w-none">
        <div className="mb-6">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">CONTAINER BOX</div>
          <h2 className="text-2xl font-black text-slate-900">コンテナボックス</h2>
          <p className="text-xs text-slate-500 mt-1">イベントに持っていく備品を計算・確認するツールです</p>
        </div>

        {active.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Boxes size={32} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm">イベントがありません</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
            {active.map(ev => (
              <motion.button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEventId(ev.id)}
                whileTap={{ scale: 0.98 }}
                className="group text-left bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex items-center gap-3"
              >
                <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Boxes size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900 truncate">{ev.venue}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{fmtDateRange(ev.start, ev.end)}</div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
