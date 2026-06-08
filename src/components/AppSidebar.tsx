import { useMemo } from 'react';
import { Calendar, ClipboardList, Building2, Plus, X, Mail } from 'lucide-react';
import { REGIONS } from '../constants';
import { rs } from '../lib/eventHelpers';
import { type StaffMember } from '../types';

const STAFF_SHOW_COUNT = 5;

export interface AppSidebarProps {
  stats: {
    total: number;
    byRegion: Record<string, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  regionFilter: string;
  setRegionFilter: (r: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  setMonthFilter: (m: string) => void;
  sidebarTypes: { label: string; icon: string }[];
  setSidebarTypes: React.Dispatch<React.SetStateAction<{ label: string; icon: string }[]>>;
  staffList: StaffMember[];
  staffExpanded: boolean;
  setStaffExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  canEditEvent: boolean;
  onAddStaff: () => void;
  onDeleteStaff: (staff: StaffMember) => void;
  onEditStaffEmail: (staff: StaffMember) => void;
  onDeleteType: (label: string) => void;
}

export default function AppSidebar({
  stats,
  regionFilter,
  setRegionFilter,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  setMonthFilter,
  sidebarTypes,
  setSidebarTypes,
  staffList,
  staffExpanded,
  setStaffExpanded,
  canEditEvent,
  onAddStaff,
  onDeleteStaff,
  onEditStaffEmail,
  onDeleteType,
}: AppSidebarProps) {
  const sortedStaff = useMemo(
    () => [...staffList].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [staffList]
  );

  return (
    <aside
      className="w-72 flex flex-col flex-shrink-0 backdrop-blur-lg border-r border-white/10 overflow-y-auto hidden md:flex"
      style={{ background: 'linear-gradient(to bottom, rgba(15,23,42,0.22) 0%, rgba(15,23,42,0.06) 100%)', textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.5)' }}
    >
      <div className="p-6 space-y-8">
        {/* TODAY Section */}
        <div className="space-y-2 pb-4 border-b border-white/10">
          <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">TODAY</div>
          <div className="text-4xl font-black text-white tracking-tighter leading-none">
            {new Date().getDate()}
          </div>
          <div className="text-xs font-bold text-white/60">
            {new Date().toLocaleDateString('ja-JP', { month: 'long', weekday: 'long' })}
          </div>
        </div>

        {/* WORKSPACE Section */}
        <div className="space-y-3">
          <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">WORKSPACE</div>
          <div className="flex flex-col gap-0.5">
            {[
              { label: "すべてのイベント", icon: <Calendar size={14} />, count: stats.total, statusValue: "all" },
              { label: "準備中", icon: <ClipboardList size={14} />, count: stats.byStatus["準備中"], statusValue: "in_progress" },
              { label: "入荷待ち", icon: <Building2 size={14} />, count: stats.byStatus["入荷待ち"], statusValue: "waiting" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setRegionFilter("すべて");
                  setTypeFilter("すべて");
                  setMonthFilter("すべて");
                  setStatusFilter(item.statusValue);
                }}
                className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 border border-transparent transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-indigo-300 opacity-70 group-hover:opacity-100">{item.icon}</span>
                  <span className="text-xs font-bold text-white/80 group-hover:text-white font-sans">{item.label}</span>
                </div>
                <span className="text-xs font-bold text-white/50">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* REGION Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-white">本部</span>
            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">REGION</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {(["すべて", ...REGIONS] as const).map((label) => (
              <button
                key={label}
                onClick={() => setRegionFilter(label)}
                className={`
                  group flex items-center justify-between px-3 py-2 rounded-lg transition-all
                  ${regionFilter === label
                    ? "bg-indigo-500/30 text-white border border-indigo-400/30"
                    : "text-white/80 hover:bg-white/10 border border-transparent"}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: rs(label).dot }}></span>
                  <span className="text-xs font-bold font-sans">{label}</span>
                </div>
                <span className="text-xs font-bold text-white/50 font-sans">{label === "すべて" ? "" : (stats.byRegion[label] || 0)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TYPE Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-white">種別</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">TYPE</span>
              <button
                onClick={() => {
                  const newType = prompt("新しい案件種別を入力してください:");
                  const trimmed = newType?.trim() ?? '';
                  if (!trimmed || trimmed.length > 50) return;
                  if (sidebarTypes.some(t => t.label === trimmed)) { alert('その種別は既に存在します'); return; }
                  const icon = prompt("絵文字アイコンを入力してください (任意):", "📋") || "📋";
                  setSidebarTypes(prev => [...prev, { label: trimmed, icon }]);
                }}
                className="p-1 hover:bg-white/10 rounded text-indigo-300 hover:text-white transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setTypeFilter("すべて")}
              className={`
                group flex items-center gap-3 px-3 py-2 rounded-lg transition-all
                ${typeFilter === "すべて"
                  ? "bg-indigo-500/30 text-white border border-indigo-400/30"
                  : "text-white/80 hover:bg-white/10 border border-transparent"}
              `}
            >
              <span className="text-sm">📁</span>
              <span className="text-xs font-bold font-sans">すべて</span>
            </button>
            {sidebarTypes.map((type) => (
              <div key={type.label} className="group relative flex items-center">
                <button
                  onClick={() => setTypeFilter(type.label)}
                  className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-all border ${
                    typeFilter === type.label ? "bg-indigo-500/30 text-white border-indigo-400/30" : "text-white/80 hover:bg-white/10 border-transparent"
                  }`}
                >
                  <span className="text-sm">{type.icon}</span>
                  <span className="text-xs font-bold font-sans">{type.label}</span>
                </button>
                {sidebarTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteType(type.label);
                    }}
                    className="absolute right-1 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-red-400 hover:bg-white/10 transition-all"
                    aria-label={`${type.label}を削除`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ステータスフィルター */}
        <div className="space-y-1 pt-2">
          <div className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] px-1 mb-3">ステータス</div>
          {[
            { label: 'すべて',    value: 'all',         dot: null },
            { label: '準備中',   value: 'in_progress',  dot: '#f59e0b' },
            { label: '入荷待ち', value: 'waiting',       dot: '#3b82f6' },
            { label: '準備完了', value: 'ready',         dot: '#10b981' },
            { label: '終了',     value: 'completed',    dot: '#94a3b8' },
          ].map(({ label, value, dot }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                statusFilter === value
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-white/80 hover:text-amber-300 hover:bg-white/10'
              }`}
            >
              {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusFilter === value ? 'white' : dot }} />}
              {label}
            </button>
          ))}
        </div>

        {/* STAFF Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-white">スタッフ</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">STAFF</span>
              {canEditEvent && (
                <button
                  onClick={onAddStaff}
                  className="p-1 hover:bg-white/10 rounded text-indigo-300 hover:text-white transition-colors"
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            {staffList.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/50">スタッフ未登録</p>
            )}
            {sortedStaff
              .slice(0, staffExpanded ? undefined : STAFF_SHOW_COUNT)
              .map((staff) => (
              <div key={staff.id} className="group relative flex items-center">
                <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 min-w-0">
                  <span className="text-sm shrink-0">👤</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold font-sans text-white/90">{staff.name}</span>
                    {staff.email && (
                      <span className="text-[10px] text-white/50 truncate">{staff.email}</span>
                    )}
                  </div>
                </div>
                {canEditEvent && (
                  <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEditStaffEmail(staff)}
                      className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-indigo-300 hover:bg-white/10 transition-all"
                      aria-label={`${staff.name}のGmailアドレスを設定`}
                    >
                      <Mail size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStaff(staff)}
                      className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-red-400 hover:bg-white/10 transition-all"
                      aria-label={`${staff.name}を削除`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {staffList.length > STAFF_SHOW_COUNT && (
              <button
                type="button"
                onClick={() => setStaffExpanded(prev => !prev)}
                className="mx-3 mt-1 py-1.5 text-[10px] font-bold text-indigo-300 hover:text-white transition-colors text-left"
              >
                {staffExpanded
                  ? '▲ 閉じる'
                  : `▼ もっと見る（あと${staffList.length - STAFF_SHOW_COUNT}人）`}
              </button>
            )}
          </div>
        </div>

      </div>
    </aside>
  );
}
