import { useState } from 'react';
import { ChevronRight, Package } from 'lucide-react';
import { Event } from '../types';
import { fmtDateRange } from '../lib/eventHelpers';

interface EventPickerTableProps {
  events: Event[];
  onSelect: (ev: Event) => void;
  variant?: 'active' | 'archive';
}

const fmtYen = (n: number) => '¥' + n.toLocaleString('ja-JP');

export default function EventPickerTable({ events, onSelect, variant = 'active' }: EventPickerTableProps) {
  const isArchive = variant === 'archive';
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="hidden md:block rounded-2xl overflow-hidden w-full border border-white/15 bg-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/50">会場</th>
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/50">期間</th>
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/50 hidden lg:table-cell">本部</th>
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/50 hidden xl:table-cell">種別</th>
            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/50 hidden xl:table-cell">クライアント</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {events.map(ev => {
            const hasBudget = (ev.prepBudgetTotal ?? 0) > 0;
            const hasItems = (ev.prepItemTotal ?? 0) > 0;
            const allDone = hasItems && (ev.prepItemDone ?? 0) >= (ev.prepItemTotal ?? 0);
            const isHovered = hoveredId === ev.id;

            return (
              <tr
                key={ev.id}
                onClick={() => onSelect(ev)}
                onMouseEnter={() => setHoveredId(ev.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`cursor-pointer border-b border-white/5 transition-colors relative ${
                  isArchive ? 'opacity-90 hover:opacity-100' : ''
                } hover:bg-white/10`}
              >
                {/* 会場 + ホバーツールチップ */}
                <td className="px-4 py-3.5 font-bold text-white truncate max-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{ev.venue}</span>
                    {/* ホバー時のコスト吹き出し */}
                    {isHovered && (
                      <div className="shrink-0 flex items-center gap-2 animate-in fade-in duration-150">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black border backdrop-blur-sm shadow-lg ${
                          hasBudget
                            ? 'bg-indigo-950/90 border-indigo-400/40 text-indigo-200'
                            : 'bg-white/10 border-white/15 text-white/40'
                        }`}>
                          <Package size={10} className="shrink-0" />
                          {hasBudget ? (
                            <span>{fmtYen(ev.prepBudgetTotal!)}</span>
                          ) : (
                            <span>費用未入力</span>
                          )}
                          {hasItems && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                              allDone
                                ? 'bg-emerald-500/30 text-emerald-300'
                                : 'bg-white/10 text-white/50'
                            }`}>
                              {ev.prepItemDone ?? 0}/{ev.prepItemTotal}件
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs text-white/50 whitespace-nowrap">{fmtDateRange(ev.start, ev.end)}</td>
                <td className="px-4 py-3.5 text-xs text-white/60 hidden lg:table-cell">{ev.region || '—'}</td>
                <td className="px-4 py-3.5 text-xs text-white/60 hidden xl:table-cell">{ev.type || '—'}</td>
                <td className="px-4 py-3.5 text-xs text-white/40 hidden xl:table-cell truncate max-w-[200px]">{ev.client || '—'}</td>
                <td className="px-2 py-3.5 text-white/30">
                  <ChevronRight size={16} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
