import { Menu, Calendar, List, Plus, Search } from 'lucide-react';

interface Props {
  view: 'calendar' | 'list';
  setView: (v: 'calendar' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onNewEvent: () => void;
}

export default function TopNav({ view, setView, searchQuery, setSearchQuery, onNewEvent }: Props) {
  return (
    <nav className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 z-20">

      {/* Left: branding */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-150 text-gray-500">
          <Menu size={18} />
        </button>
        <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          EX
        </div>
        <div className="hidden sm:block">
          <div className="font-bold text-sm text-gray-800 leading-tight">Ivent Manager</div>
          <div className="text-[10px] text-gray-400 leading-tight">Preparation &amp; Scheduling</div>
        </div>
      </div>

      {/* Center: search */}
      <div className="flex-1 flex justify-center px-4">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="会場・クライアントを検索..."
            className="w-full bg-gray-100 rounded-lg pl-8 pr-12 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all duration-150"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <kbd className="bg-gray-200 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-mono leading-none">
              K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: view toggle + new button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {([
            { id: 'calendar' as const, icon: <Calendar size={14} />, label: 'カレンダー' },
            { id: 'list'     as const, icon: <List size={14} />,     label: 'リスト' },
          ]).map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                view === v.id
                  ? 'bg-white shadow-sm text-gray-800 border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onNewEvent}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>新規イベント</span>
        </button>
      </div>
    </nav>
  );
}
