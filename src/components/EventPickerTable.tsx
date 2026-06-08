import { ChevronRight } from 'lucide-react';
import { Event } from '../types';
import { fmtDateRange } from '../lib/eventHelpers';

interface EventPickerTableProps {
  events: Event[];
  onSelect: (ev: Event) => void;
  variant?: 'active' | 'archive';
}

export default function EventPickerTable({ events, onSelect, variant = 'active' }: EventPickerTableProps) {
  const isArchive = variant === 'archive';

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
          {events.map(ev => (
            <tr
              key={ev.id}
              onClick={() => onSelect(ev)}
              className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/10 ${isArchive ? 'opacity-90 hover:opacity-100' : ''}`}
            >
              <td className="px-4 py-3.5 font-bold text-white truncate max-w-[280px]">{ev.venue}</td>
              <td className="px-4 py-3.5 text-xs text-white/50 whitespace-nowrap">{fmtDateRange(ev.start, ev.end)}</td>
              <td className="px-4 py-3.5 text-xs text-white/60 hidden lg:table-cell">{ev.region || '—'}</td>
              <td className="px-4 py-3.5 text-xs text-white/60 hidden xl:table-cell">{ev.type || '—'}</td>
              <td className="px-4 py-3.5 text-xs text-white/40 hidden xl:table-cell truncate max-w-[200px]">{ev.client || '—'}</td>
              <td className="px-2 py-3.5 text-white/30">
                <ChevronRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
