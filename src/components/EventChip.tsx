import React from 'react';
import { CalendarEvent } from '../types/index';

interface EventChipProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}

const EventChip: React.FC<EventChipProps> = ({ event, onClick }) => {
  return (
    <button
      onClick={() => onClick(event)}
      title={`${event.venue} — ${event.client}`}
      className="w-full text-left flex items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-gray-700 truncate hover:brightness-95 transition-all duration-150 cursor-pointer"
      style={{
        borderLeft: `3px solid ${event.color}`,
        backgroundColor: `${event.color}1A`,
      }}
    >
      <span className="shrink-0 leading-none">{event.emoji}</span>
      <span className="truncate font-medium leading-tight">{event.venue}</span>
    </button>
  );
};

export default EventChip;
