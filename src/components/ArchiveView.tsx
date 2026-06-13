import { Archive, CalendarDays, MapPin, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Event } from '../types';
import { fmtDateRange, rs, normalizeRegion } from '../lib/eventHelpers';
import EventPickerTable from './EventPickerTable';
import { EASE_OUT, DUR_MD, DUR_LG, STAGGER_MED } from '../lib/motionTokens';

interface ArchiveViewProps {
  events: Event[];
  onSelectEvent: (ev: Event) => void;
}

function statusPill(status: string | undefined): { label: string; cls: string } {
  if (status === 'cancelled') return { label: 'キャンセル', cls: 'bg-red-50 border border-red-200 text-red-700' };
  return { label: '完了', cls: 'bg-emerald-50 border border-emerald-200 text-emerald-700' };
}

function yearsAgoLabel(startDate: string): string {
  const y = parseInt(startDate.slice(0, 4));
  const now = new Date().getFullYear();
  const diff = now - y;
  if (diff === 0) return '今年';
  if (diff === 1) return '1年前';
  return `${diff}年前`;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0 },
};

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: STAGGER_MED } },
};

export default function ArchiveView({ events, onSelectEvent }: ArchiveViewProps) {
  const today = new Date().toISOString().slice(0, 10);

  const archivedEvents = [...events]
    .filter(ev => (ev.end || ev.start) < today)
    .sort((a, b) => (b.end || b.start).localeCompare(a.end || a.start));

  // Group by year → month
  const yearGroups: { year: string; months: { month: string; events: Event[] }[] }[] = [];
  for (const ev of archivedEvents) {
    const [y, m] = ev.start.split('-');
    const year = `${parseInt(y)}`;
    const month = `${parseInt(m)}月`;
    let yg = yearGroups.find(g => g.year === year);
    if (!yg) { yg = { year, months: [] }; yearGroups.push(yg); }
    let mg = yg.months.find(g => g.month === month);
    if (!mg) { mg = { month, events: [] }; yg.months.push(mg); }
    mg.events.push(ev);
  }

  // Stats
  const totalDays = archivedEvents.reduce((sum, ev) => {
    if (!ev.end || ev.end === ev.start) return sum + 1;
    return sum + Math.round((new Date(ev.end + 'T00:00:00').getTime() - new Date(ev.start + 'T00:00:00').getTime()) / 86400000) + 1;
  }, 0);
  const uniqueVenues = new Set(archivedEvents.map(ev => ev.venue)).size;
  const yearsSpan = yearGroups.length;

  return (
    <div className="relative z-10 w-full">
      <div className="flex flex-col gap-6 px-4 md:px-6 pt-6 pb-32 md:pb-8 w-full max-w-none">

        {/* ── ヘッダー ─────────────────────────────────────── */}
        <motion.div
          initial="hidden" animate="show" variants={container}
        >
          <motion.div variants={fadeUp} transition={{ duration: DUR_MD, ease: EASE_OUT }}>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Archive size={10} />
              ARCHIVE
            </div>
            <div className="flex items-baseline gap-3 mb-5">
              <h2 className="text-2xl font-black text-slate-900">アーカイブ</h2>
              {archivedEvents.length > 0 && (
                <span className="text-[11px] text-slate-400 font-semibold">{archivedEvents.length}件の記録</span>
              )}
            </div>
          </motion.div>

          {/* 統計サマリー */}
          {archivedEvents.length > 0 && (
            <motion.div
              variants={fadeUp}
              transition={{ duration: DUR_MD, ease: EASE_OUT }}
              className="grid grid-cols-3 gap-3 mb-6"
            >
              {[
                { icon: CalendarDays, label: '開催日数', value: `${totalDays}日`, sub: '累計' },
                { icon: MapPin,       label: '会場数',   value: `${uniqueVenues}`,  sub: 'ユニーク' },
                { icon: TrendingUp,   label: '実績年数', value: `${yearsSpan}年`,   sub: '分の記録' },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div
                  key={label}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-3.5 shadow-sm"
                >
                  <div className="absolute -top-3 -right-3 opacity-5">
                    <Icon size={52} strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon size={11} className="text-indigo-400 shrink-0" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-800 leading-none">{value}</span>
                    <span className="text-[10px] text-slate-400">{sub}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* ── 空状態 ────────────────────────────────────────── */}
        {archivedEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DUR_LG, ease: EASE_OUT }}
            className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 py-16 text-center"
          >
            <Archive size={32} className="mx-auto mb-3 text-slate-300" strokeWidth={1.2} />
            <p className="text-sm text-slate-400 font-medium">アーカイブされたイベントがありません</p>
            <p className="text-xs text-slate-300 mt-1">完了したイベントがここに記録されます</p>
          </motion.div>
        ) : (
          <>
            {/* ── デスクトップ表 ──────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR_MD, ease: EASE_OUT, delay: 0.08 }}
            >
              <EventPickerTable events={archivedEvents} onSelect={onSelectEvent} variant="archive" />
            </motion.div>

            {/* ── モバイル: 年別タイムライン ──────────────── */}
            <div className="md:hidden flex flex-col gap-8">
              {yearGroups.map((yg, yi) => (
                <motion.div
                  key={yg.year}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={container}
                >
                  {/* 年セパレータ */}
                  <motion.div
                    variants={fadeUp}
                    transition={{ duration: DUR_MD, ease: EASE_OUT }}
                    className="flex items-center gap-3 mb-4"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-800 leading-none">{yg.year}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {yearsAgoLabel(`${yg.year}-01-01`)}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {yg.months.reduce((s, m) => s + m.events.length, 0)}件
                    </span>
                  </motion.div>

                  {/* 月グループ */}
                  <div className="flex flex-col gap-5 pl-3 border-l-2 border-slate-100">
                    {yg.months.map((mg, mi) => (
                      <div key={mg.month}>
                        {/* 月ラベル */}
                        <motion.div
                          variants={fadeUp}
                          transition={{ duration: DUR_MD, ease: EASE_OUT, delay: mi * 0.03 }}
                          className="flex items-center gap-2 mb-2.5 -ml-[13px]"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                            {mg.month}
                          </span>
                          <span className="text-[10px] text-slate-400">{mg.events.length}件</span>
                        </motion.div>

                        {/* イベントカード */}
                        <motion.div
                          className="flex flex-col gap-2.5"
                          variants={container}
                        >
                          {mg.events.map((ev, ei) => {
                            const st = statusPill(ev.status);
                            const regionStyle = rs(ev.region || '');
                            return (
                              <motion.button
                                key={ev.id}
                                variants={fadeUp}
                                transition={{ duration: DUR_MD, ease: EASE_OUT, delay: ei * 0.04 }}
                                whileHover={{ y: -2, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.10)' }}
                                whileTap={{ scale: 0.985 }}
                                onClick={() => onSelectEvent(ev)}
                                className="w-full text-left rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-sm transition-colors hover:border-slate-300 group"
                              >
                                <div className="flex items-stretch">
                                  {/* 地域カラー縦線 */}
                                  <div className="w-1.5 shrink-0" style={{ background: regionStyle.dot }} />

                                  <div className="flex-1 min-w-0 px-4 py-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        {/* 会場名 + ステータス */}
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                          <span className="text-sm font-black text-slate-800 truncate">
                                            {ev.venue}
                                          </span>
                                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black ${st.cls}`}>
                                            {st.label}
                                          </span>
                                        </div>
                                        {/* 日付 */}
                                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mb-1.5">
                                          <CalendarDays size={9} className="shrink-0 text-slate-400" />
                                          {fmtDateRange(ev.start, ev.end)}
                                        </div>
                                        {/* 本部 + クライアント */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {ev.region && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                                              style={{ background: regionStyle.bg + '99', color: regionStyle.text }}>
                                              {normalizeRegion(ev.region)}
                                            </span>
                                          )}
                                          {ev.client && (
                                            <span className="text-[10px] text-slate-400 truncate">{ev.client}</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* 右: 何年前 */}
                                      <div className="shrink-0 text-right">
                                        <span className="text-[10px] font-black text-slate-300 group-hover:text-slate-400 transition-colors">
                                          {yearsAgoLabel(ev.start)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* 下部フッター */}
              {archivedEvents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: DUR_LG, ease: EASE_OUT }}
                  className="flex items-center gap-3 py-2"
                >
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                    <Archive size={9} />
                    <span>{archivedEvents.length}件の記録 · 以上</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-slate-200 to-transparent" />
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
