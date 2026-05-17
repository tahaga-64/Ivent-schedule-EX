import { Calendar, ClipboardList, Clock } from 'lucide-react';
import { CalendarEvent, Region, EventType } from '../types/index';
import { DATA } from '../constants';
import { EVENT_TYPES } from '../data/eventTypes';

interface Props {
  selectedRegion: Region | '全て';
  setSelectedRegion: (r: Region | '全て') => void;
  selectedType: EventType | '全て';
  setSelectedType: (t: EventType | '全て') => void;
  filteredEvents: CalendarEvent[];
}

const REGIONS: { label: Region | '全て'; dot: string }[] = [
  { label: '全て',  dot: '#9CA3AF' },
  { label: '東日本', dot: '#3B82F6' },
  { label: '西日本', dot: '#22C55E' },
  { label: '南日本', dot: '#F97316' },
  { label: '中日本', dot: '#A855F7' },
];


export default function Sidebar({
  selectedRegion, setSelectedRegion,
  selectedType,   setSelectedType,
  filteredEvents,
}: Props) {
  const today = new Date();
  const DAY_NAMES   = ['日','月','火','水','木','金','土'];
  const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  const allEvents      = DATA;
  const preparedCount  = filteredEvents.filter(e => e.status === '完了').length;
  const waitingCount   = filteredEvents.filter(e => e.status === '入荷待ち').length;

  const regionCounts = REGIONS.reduce<Record<string, number>>((acc, r) => {
    if (r.label !== '全て') acc[r.label] = allEvents.filter(e => e.region === r.label).length;
    return acc;
  }, {});

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          EX
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm text-gray-800 leading-tight truncate">Ivent Manager</div>
          <div className="text-xs text-gray-400 truncate">Preparation &amp; Scheduling</div>
        </div>
      </div>

      {/* Today Widget */}
      <div className="mx-3 mt-4 p-3 bg-gray-50 rounded-xl">
        <div className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">TODAY</div>
        <div className="text-3xl font-bold text-gray-800 leading-none">{today.getDate()}</div>
        <div className="text-sm text-gray-500 mt-1">
          {MONTH_NAMES[today.getMonth()]} {DAY_NAMES[today.getDay()]}
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="mt-5">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 mb-1.5">
          WORKSPACE
        </div>
        {([
          { label: 'すべてのイベント', icon: <Calendar size={14} />, count: allEvents.length },
          { label: '完了',           icon: <ClipboardList size={14} />, count: preparedCount },
          { label: '入荷待ち',        icon: <Clock size={14} />, count: waitingCount },
        ] as const).map(item => (
          <button
            key={item.label}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-gray-50 transition-all duration-150"
          >
            <span className="text-indigo-500 flex-shrink-0">{item.icon}</span>
            <span className="flex-1 text-left text-gray-700 font-medium">{item.label}</span>
            <span className="bg-gray-100 text-gray-500 text-xs rounded-full px-2 py-0.5 font-medium">
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* 地域 / REGION */}
      <div className="mt-5">
        <div className="flex items-center px-4 mb-1.5">
          <span className="text-sm font-medium text-gray-700">地域</span>
          <span className="ml-auto text-[10px] text-gray-400 font-semibold uppercase tracking-wider">REGION</span>
        </div>
        {REGIONS.map(r => (
          <button
            key={r.label}
            onClick={() => setSelectedRegion(r.label)}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all duration-150 border-l-2 ${
              selectedRegion === r.label
                ? 'border-gray-400 bg-gray-50 font-semibold text-gray-800'
                : 'border-transparent hover:bg-gray-50 text-gray-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.dot }} />
            <span className="flex-1 text-left">{r.label}</span>
            {r.label !== '全て' && (
              <span className="text-xs text-gray-400">{regionCounts[r.label] ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* 種別 / TYPE */}
      <div className="mt-5 pb-6">
        <div className="flex items-center px-4 mb-1.5">
          <span className="text-sm font-medium text-gray-700">種別</span>
          <span className="ml-auto text-[10px] text-gray-400 font-semibold uppercase tracking-wider">TYPE</span>
        </div>
        {EVENT_TYPES.map(t => (
          <button
            key={t.label}
            onClick={() => setSelectedType(selectedType === t.label ? '全て' : t.label as EventType)}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all duration-150 ${
              selectedType === t.label
                ? 'bg-indigo-50 text-indigo-600 font-semibold'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <span className="text-base leading-none">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
