import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import CalendarGrid from './components/CalendarGrid';
import NewEventModal from './components/NewEventModal';
import { CalendarEvent, Region, EventType, NewEventDraft } from './types/index';
import { MOCK_EVENTS } from './data/events';

const EMOJI_MAP: Record<EventType, string> = {
  '????':     '??',
  '???':       '??',
  '??':         '??',
  'DJI':          '??',
  '??????': '??',
  '???????': '??',
  '???':       '??',
};

const COLOR_MAP: Record<EventType, string> = {
  '????':     '#22C55E',
  '???':       '#3B82F6',
  '??':         '#A855F7',
  'DJI':          '#6366F1',
  '??????': '#F43F5E',
  '???????': '#F97316',
  '???':       '#9CA3AF',
};

const STATUS_COLOR: Record<string, string> = {
  '???':   'bg-blue-50 text-blue-600',
  '????': 'bg-amber-50 text-amber-600',
  '??':     'bg-green-50 text-green-600',
};

export default function App() {
  const today = new Date();

  const [view,           setView]           = useState<'calendar' | 'list'>('calendar');
  const [currentYear,    setCurrentYear]    = useState(2026);
  const [currentMonth,   setCurrentMonth]   = useState(5);
  const [selectedRegion, setSelectedRegion] = useState<Region | '???'>('???');
  const [selectedType,   setSelectedType]   = useState<EventType | '???'>('???');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showModal,      setShowModal]      = useState(false);
  const [events,         setEvents]         = useState<CalendarEvent[]>(MOCK_EVENTS);
  const [selectedEvent,  setSelectedEvent]  = useState<CalendarEvent | null>(null);

  const filteredEvents = useMemo(() =>
    events.filter(ev => {
      if (selectedRegion !== '???' && ev.region !== selectedRegion) return false;
      if (selectedType   !== '???' && ev.type   !== selectedType)   return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!ev.venue.toLowerCase().includes(q) && !ev.client.toLowerCase().includes(q)) return false;
      }
      return true;
    }),
    [events, selectedRegion, selectedType, searchQuery]
  );

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentYear(y => y - 1); setCurrentMonth(12); }
    else setCurrentMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentYear(y => y + 1); setCurrentMonth(1); }
    else setCurrentMonth(m => m + 1);
  };
  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  const handleNewEvent = (draft: NewEventDraft) => {
    const newEv: CalendarEvent = {
      id:     crypto.randomUUID(),
      status: '???',
      emoji:  EMOJI_MAP[draft.type] ?? '??',
      color:  COLOR_MAP[draft.type] ?? '#6366F1',
      ...draft,
    };
    setEvents(prev => [...prev, newEv]);
    const [y, m] = draft.start.split('-').map(Number);
    setCurrentYear(y);
    setCurrentMonth(m);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      <Sidebar
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        filteredEvents={filteredEvents}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav
          view={view}
          setView={setView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNewEvent={() => setShowModal(true)}
        />

        <main className="flex-1 overflow-y-auto p-6">

          {view === 'calendar' && (
            <CalendarGrid
              year={currentYear}
              month={currentMonth}
              events={filteredEvents}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
              onSelectEvent={setSelectedEvent}
            />
          )}

          {view === 'list' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {filteredEvents.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-sm">????????????</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['??','??','??','??','??????','?????'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEvents
                      .slice()
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map(ev => (
                        <tr
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="hover:bg-gray-50 transition-all duration-150 cursor-pointer"
                        >
                          <td className="px-5 py-3.5 text-xs text-gray-600 font-mono whitespace-nowrap">
                            {ev.start}{ev.start !== ev.end ? ` ? ${ev.end}` : ''}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                              {ev.region}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm">{ev.emoji} {ev.type}</td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-gray-800">{ev.venue}</td>
                          <td className="px-5 py-3.5 text-sm text-gray-500">{ev.client}</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[ev.status] ?? ''}`}>
                              {ev.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>
      </div>

      {/* New Event Modal */}
      {showModal && (
        <NewEventModal
          onClose={() => setShowModal(false)}
          onSubmit={handleNewEvent}
        />
      )}

      {/* Event Detail popup */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-white rounded-2xl shadow-md w-full max-w-sm p-6 z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${selectedEvent.color}1A`, color: selectedEvent.color }}>
                  {selectedEvent.emoji} {selectedEvent.type}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {selectedEvent.region}
                </span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 text-lg leading-none">
                ?
              </button>
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">{selectedEvent.venue}</h3>
            <p className="text-sm text-gray-500 mb-3">{selectedEvent.client}</p>
            <p className="text-xs text-gray-400 font-mono">
              {selectedEvent.start}
              {selectedEvent.start !== selectedEvent.end && ` ? ${selectedEvent.end}`}
            </p>
            <div className="mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[selectedEvent.status] ?? ''}`}>
                {selectedEvent.status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
