import { useState, useEffect } from 'react';
import { ChevronRight, Megaphone } from 'lucide-react';
import { Event } from '../types';
import { fmtDateRange, rs, ts, normalizeRegion } from '../lib/eventHelpers';
import EventPickerTable from './EventPickerTable';
import { subscribePastNotices, type Notice } from '../lib/notices';

interface ArchiveViewProps {
  events: Event[];
  onSelectEvent: (ev: Event) => void;
}

type ArchiveTab = 'events' | 'notices';

function statusPill(status: string | undefined): { label: string; cls: string } {
  if (status === 'cancelled') return { label: 'キャンセル', cls: 'bg-red-50 border border-red-200 text-red-800' };
  return { label: '完了', cls: 'bg-slate-100 border border-slate-200 text-slate-600' };
}

export default function ArchiveView({ events, onSelectEvent }: ArchiveViewProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<ArchiveTab>('events');
  const [pastNotices, setPastNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const unsub = subscribePastNotices(today, setPastNotices);
    return unsub;
  }, [today]);

  const archivedEvents = [...events]
    .filter(ev => (ev.end || ev.start) < today)
    .sort((a, b) => (b.end || b.start).localeCompare(a.end || a.start));

  const monthGroups: { month: string; events: Event[] }[] = [];
  for (const ev of archivedEvents) {
    const [y, m] = ev.start.split('-');
    const label = `${parseInt(y)}年${parseInt(m)}月`;
    const last = monthGroups[monthGroups.length - 1];
    if (last?.month === label) last.events.push(ev);
    else monthGroups.push({ month: label, events: [ev] });
  }

  // 連絡事項を月ごとにグループ化（新しい順）
  const noticeGroups: { month: string; notices: Notice[] }[] = [];
  for (const n of pastNotices) {
    const [y, m] = n.date.split('-');
    const label = `${parseInt(y)}年${parseInt(m)}月`;
    const last = noticeGroups[noticeGroups.length - 1];
    if (last?.month === label) last.notices.push(n);
    else noticeGroups.push({ month: label, notices: [n] });
  }

  return (
    <div className="relative z-10 w-full">
      <div className="flex flex-col gap-5 px-4 md:px-6 pt-6 pb-32 md:pb-8 w-full max-w-none">

        <div className="mb-2">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ARCHIVE</div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-black text-slate-900">アーカイブ</h2>
            {tab === 'events' && archivedEvents.length > 0 && (
              <span className="text-[10px] text-slate-400 font-medium">{archivedEvents.length}件</span>
            )}
            {tab === 'notices' && pastNotices.length > 0 && (
              <span className="text-[10px] text-slate-400 font-medium">{pastNotices.length}件</span>
            )}
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 w-full max-w-xs mb-2">
          {([['events', 'イベント'], ['notices', '連絡事項']] as [ArchiveTab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'notices' ? (
          noticeGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-400 shadow-sm">
              過去の連絡事項はありません
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {noticeGroups.map(({ month, notices }) => (
                <div key={month}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-0.5 h-4 bg-slate-300 rounded-full shrink-0" />
                    <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{month}</div>
                    <span className="text-[10px] text-slate-400">{notices.length}件</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {notices.map(n => (
                      <div key={n.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-start gap-3">
                        <Megaphone size={14} className="text-amber-500 shrink-0 mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-black text-slate-500 font-mono">{n.date}</span>
                            {n.createdByName && <span className="text-[10px] text-slate-400">{n.createdByName}</span>}
                          </div>
                          <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap break-words">{n.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : archivedEvents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-sm text-slate-400 shadow-sm">
            アーカイブされたイベントがありません
          </div>
        ) : (
          <>
          <EventPickerTable events={archivedEvents} onSelect={onSelectEvent} variant="archive" />
          <div className="md:hidden flex flex-col gap-5">
          {monthGroups.map(({ month, events: evs }) => (
            <div key={month}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-0.5 h-4 bg-slate-300 rounded-full shrink-0" />
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{month}</div>
                <span className="text-[10px] text-slate-400">{evs.length}件</span>
              </div>
              <div className="flex flex-col gap-2">
                {evs.map(ev => {
                  const st = statusPill(ev.status);
                  const regionColor = rs(ev.region || '').dot;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm flex items-stretch overflow-hidden hover:bg-slate-50 active:scale-[0.99] transition-all group opacity-75 hover:opacity-100"
                    >
                      <div className="w-1 shrink-0" style={{ background: regionColor }} />
                      <div className="flex-1 min-w-0 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-base font-black text-slate-900 truncate">{ev.venue}</span>
                              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${st.cls}`}>{st.label}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {fmtDateRange(ev.start, ev.end)}{ev.client ? ` · ${ev.client}` : ''}{ev.region ? ` · ${normalizeRegion(ev.region)}` : ''}
                            </div>
                          </div>
                          <ChevronRight size={15} className="text-slate-400 group-hover:text-slate-600 shrink-0 mt-1 transition-colors" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
