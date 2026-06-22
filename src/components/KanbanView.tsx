import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Event, EventStatus } from '../types';

interface ColumnDef { status: string; label: string; dot: string; headerBg: string; headerText: string; cardBorder: string; badgeBg: string; badgeText: string }

const COLUMNS: ColumnDef[] = [
  { status: 'scheduled', label: '予定',    dot: '#94a3b8', headerBg: 'rgba(148,163,184,0.15)', headerText: '#475569', cardBorder: 'rgba(148,163,184,0.35)', badgeBg: 'rgba(148,163,184,0.20)', badgeText: '#64748b' },
  { status: 'decided',   label: '開催決定',dot: '#6366f1', headerBg: 'rgba(99,102,241,0.12)',  headerText: '#4338ca', cardBorder: 'rgba(99,102,241,0.30)',  badgeBg: 'rgba(99,102,241,0.15)',  badgeText: '#4f46e5' },
  { status: 'completed', label: '終了',    dot: '#f97316', headerBg: 'rgba(249,115,22,0.10)',  headerText: '#c2410c', cardBorder: 'rgba(249,115,22,0.30)',  badgeBg: 'rgba(249,115,22,0.15)',  badgeText: '#ea580c' },
];

interface Props {
  events: Event[];
  prepProgressMap: Record<string, { total: number; done: number }>;
  onSelectEvent: (event: Event) => void;
  onUpdateStatus: (eventId: string, status: EventStatus) => void;
  canEdit: boolean;
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

export default function KanbanView({ events, prepProgressMap, onSelectEvent, onUpdateStatus, canEdit }: Props) {
  const grouped = useMemo(() => {
    const map: Record<string, Event[]> = {};
    COLUMNS.forEach(c => { map[c.status] = []; });
    events.forEach(ev => {
      if (ev.status === 'cancelled') return;
      const s = ev.status ?? 'scheduled';
      if (s === 'in_progress' || s === 'waiting' || s === 'ready') {
        map['decided'].push(ev);
      } else if (map[s]) {
        map[s].push(ev);
      } else {
        map['scheduled'].push(ev);
      }
    });
    return map;
  }, [events]);

  return (
    <div className="flex gap-3 p-4 overflow-x-auto pb-24 min-h-full items-start">
      {COLUMNS.map((col, colIdx) => {
        const colEvents = grouped[col.status] ?? [];
        const prevCol = colIdx > 0 ? COLUMNS[colIdx - 1] : null;
        const nextCol = colIdx < COLUMNS.length - 1 ? COLUMNS[colIdx + 1] : null;

        return (
          <div key={col.status} className="flex-shrink-0 w-60 flex flex-col gap-2">
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: col.headerBg, color: col.headerText }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.dot }} />
                <span className="text-xs font-black">{col.label}</span>
              </div>
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: col.badgeBg, color: col.badgeText }}
              >
                {colEvents.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-[60px]">
              {colEvents.map(ev => {
                const prog = prepProgressMap[ev.id];
                const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : -1;

                return (
                  <motion.div
                    key={ev.id}
                    layout
                    className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                    style={{ border: `1px solid ${col.cardBorder}`, borderLeftWidth: 3 }}
                  >
                    <button onClick={() => onSelectEvent(ev)} className="w-full text-left">
                      <div className="text-xs font-black text-slate-900 leading-snug mb-1">{ev.venue}</div>
                      <div className="text-[10px] text-slate-500 mb-2">
                        {fmtDate(ev.start)}{ev.end && ev.end !== ev.start ? `→${fmtDate(ev.end)}` : ''}
                        {ev.client ? ` · ${ev.client}` : ''}
                      </div>
                      {pct >= 0 && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{prog!.done}/{prog!.total}</span>
                        </div>
                      )}
                    </button>

                    {canEdit && (
                      <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-200">
                        {prevCol ? (
                          <button
                            onClick={() => onUpdateStatus(ev.id, prevCol.status as EventStatus)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all"
                            style={{ color: prevCol.headerText, background: prevCol.badgeBg }}
                          >
                            ← {prevCol.label}
                          </button>
                        ) : <span />}
                        {nextCol ? (
                          <button
                            onClick={() => onUpdateStatus(ev.id, nextCol.status as EventStatus)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all"
                            style={{ color: nextCol.headerText, background: nextCol.badgeBg }}
                          >
                            {nextCol.label} →
                          </button>
                        ) : <span />}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {colEvents.length === 0 && (
                <div className="text-center py-8 text-[10px] text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
                  なし
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
