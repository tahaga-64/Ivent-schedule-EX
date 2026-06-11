import { useMemo } from 'react';
import { Calendar, ClipboardList, Building2, Plus, X, Mail } from 'lucide-react';
import { REGIONS } from '../constants';
import { rs } from '../lib/eventHelpers';
import { type StaffMember } from '../types';

const STAFF_SHOW_COUNT = 5;

export interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
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
  sidebarTypes: { label: string }[];
  setSidebarTypes: React.Dispatch<React.SetStateAction<{ label: string }[]>>;
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
  open,
  onClose,
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

  const afterFilter = (fn: () => void) => {
    fn();
    if (window.matchMedia('(max-width: 767px)').matches) onClose();
  };

  const content = (
    <div className="p-5 md:p-6 space-y-7 md:space-y-8">
      {/* TODAY Section */}
      <div className="space-y-2 pb-4 border-b border-slate-200">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TODAY</div>
        <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
          {new Date().getDate()}
        </div>
        <div className="text-xs font-bold text-slate-600">
          {new Date().toLocaleDateString('ja-JP', { month: 'long', weekday: 'long' })}
        </div>
      </div>

      {/* WORKSPACE Section */}
      <div className="space-y-3">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WORKSPACE</div>
        <div className="flex flex-col gap-0.5">
          {[
            { label: "すべてのイベント", icon: <Calendar size={14} />, count: stats.total, statusValue: "all" },
            { label: "準備中", icon: <ClipboardList size={14} />, count: stats.byStatus["準備中"], statusValue: "in_progress" },
            { label: "入荷待ち", icon: <Building2 size={14} />, count: stats.byStatus["入荷待ち"], statusValue: "waiting" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => afterFilter(() => {
                setRegionFilter("すべて");
                setTypeFilter("すべて");
                setMonthFilter("すべて");
                setStatusFilter(item.statusValue);
              })}
              className="group flex items-center justify-between px-3 py-3 md:py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 border border-transparent transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-indigo-600 opacity-70 group-hover:opacity-100">{item.icon}</span>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 font-sans">{item.label}</span>
              </div>
              <span className="text-xs font-bold text-slate-500">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* REGION Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-900">本部</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">REGION</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {(["すべて", ...REGIONS] as const).map((label) => (
            <button
              key={label}
              onClick={() => afterFilter(() => setRegionFilter(label))}
              className={`
                group flex items-center justify-between px-3 py-2.5 md:py-2 rounded-lg transition-all
                ${regionFilter === label
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-transparent"}
              `}
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: rs(label).dot }}></span>
                <span className="text-xs font-bold font-sans">{label}</span>
              </div>
              <span className="text-xs font-bold text-slate-500 font-sans">{label === "すべて" ? "" : (stats.byRegion[label] || 0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TYPE Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-900">種別</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TYPE</span>
            <button
              onClick={() => {
                const newType = prompt("新しい案件種別を入力してください:");
                const trimmed = newType?.trim() ?? '';
                if (!trimmed || trimmed.length > 50) return;
                if (sidebarTypes.some(t => t.label === trimmed)) { alert('その種別は既に存在します'); return; }
                setSidebarTypes(prev => [...prev, { label: trimmed }]);
              }}
              className="p-1.5 hover:bg-slate-100 rounded text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => afterFilter(() => setTypeFilter("すべて"))}
            className={`
              group flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg transition-all
              ${typeFilter === "すべて"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-transparent"}
            `}
          >
            <span className="text-xs font-bold font-sans">すべて</span>
          </button>
          {sidebarTypes.map((type) => (
            <div key={type.label} className="group relative flex items-center">
              <button
                onClick={() => afterFilter(() => setTypeFilter(type.label))}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg transition-all border ${
                  typeFilter === type.label ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-transparent"
                }`}
              >
                <span className="text-xs font-bold font-sans">{type.label}</span>
              </button>
              {sidebarTypes.length > 1 && canEditEvent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteType(type.label);
                  }}
                  className="absolute right-1 md:opacity-0 md:group-hover:opacity-100 w-8 h-8 md:w-5 md:h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-all"
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
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 mb-3">ステータス</div>
        {[
          { label: 'すべて',    value: 'all',         dot: null },
          { label: '準備中',   value: 'in_progress',  dot: '#f59e0b' },
          { label: '入荷待ち', value: 'waiting',       dot: '#3b82f6' },
          { label: '準備完了', value: 'ready',         dot: '#10b981' },
          { label: '終了',     value: 'completed',    dot: '#94a3b8' },
        ].map(({ label, value, dot }) => (
          <button
            key={value}
            onClick={() => afterFilter(() => setStatusFilter(value))}
            className={`w-full text-left px-4 py-3 md:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              statusFilter === value
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-slate-700 hover:text-amber-700 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusFilter === value ? 'white' : dot }} />}
            {label}
          </button>
        ))}
      </div>

      {/* STAFF Section */}
      <div className="space-y-3 pt-2 pb-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-900">スタッフ</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">STAFF</span>
            {canEditEvent && (
              <button
                onClick={onAddStaff}
                className="p-1.5 hover:bg-slate-100 rounded text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          {staffList.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">スタッフ未登録</p>
          )}
          {sortedStaff
            .slice(0, staffExpanded ? undefined : STAFF_SHOW_COUNT)
            .map((staff) => (
            <div key={staff.id} className="group relative flex items-center">
              <div className="flex-1 flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-slate-700 min-w-0">
                <span className="text-sm shrink-0">👤</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold font-sans text-slate-900">{staff.name}</span>
                  {staff.email && (
                    <span className="text-[10px] text-slate-500 truncate">{staff.email}</span>
                  )}
                </div>
              </div>
              {canEditEvent && (
                <div className="absolute right-1 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onEditStaffEmail(staff)}
                    className="w-8 h-8 md:w-5 md:h-5 flex items-center justify-center rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-all"
                    aria-label={`${staff.name}のGmailアドレスを設定`}
                  >
                    <Mail size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteStaff(staff)}
                    className="w-8 h-8 md:w-5 md:h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-all"
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
              className="mx-3 mt-1 py-2 md:py-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors text-left"
            >
              {staffExpanded
                ? '▲ 閉じる'
                : `▼ もっと見る（あと${staffList.length - STAFF_SHOW_COUNT}人）`}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // モバイルではサイドバーを表示しない（PC専用）
  return (
    <>
      {open && (
        <aside
          className="hidden md:flex w-72 flex-col flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto"
        >
          {content}
        </aside>
      )}
    </>
  );
}
