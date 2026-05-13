interface Props {
  dailyAttendance: { date: string; attendance: number }[];
}

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayBasedDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export default function AttendanceHeatmap({ dailyAttendance }: Props) {
  const attendanceByDay: Record<string, number> = {};
  dailyAttendance.forEach((d) => {
    attendanceByDay[d.date] = (attendanceByDay[d.date] || 0) + d.attendance;
  });

  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - 7 * 52 + 1);

  const startOffset = mondayBasedDay(start);
  start.setDate(start.getDate() - startOffset);

  const cells: { date: Date; value: number; month: number; isInRange: boolean }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7 * 53; i++) {
    const key = toDateString(cursor);
    const value = attendanceByDay[key] ?? 0;
    const isInRange = cursor >= new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7 * 52 + 1) && cursor <= end;
    cells.push({ date: new Date(cursor), value, month: cursor.getMonth(), isInRange });
    cursor.setDate(cursor.getDate() + 1);
  }

  const maxValue = Math.max(...cells.map(c => c.value), 0);
  const weekCount = Math.ceil(cells.length / 7);

  const monthLabels: { label: string; col: number }[] = [];
  for (let col = 0; col < weekCount; col++) {
    const idx = col * 7;
    const cell = cells[idx];
    if (!cell) continue;
    const monthLabel = `${cell.date.getMonth() + 1}月`;
    const prevMonth = col === 0 ? -1 : cells[(col - 1) * 7]?.month;
    if (cell.month !== prevMonth) {
      monthLabels.push({ label: monthLabel, col });
    }
  }

  const tone = (value: number) => {
    if (value <= 0) return 'bg-slate-100';
    if (maxValue === 0) return 'bg-slate-100';
    const ratio = value / maxValue;
    if (ratio < 0.34) return 'bg-indigo-200';
    if (ratio < 0.67) return 'bg-indigo-400';
    return 'bg-indigo-600';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="ml-10 mb-2 relative h-5">
          {monthLabels.map((m) => (
            <span
              key={`${m.label}-${m.col}`}
              className="absolute text-[10px] font-bold text-slate-400"
              style={{ left: `${m.col * 16}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="w-8 flex flex-col gap-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="h-3 text-[10px] text-slate-400 font-bold">
                {d}
              </div>
            ))}
          </div>
          <div
            className="grid gap-1"
            style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))', gridAutoFlow: 'column', gridAutoColumns: '14px' }}
          >
            {cells.map((cell) => (
              <div
                key={toDateString(cell.date)}
                className={`w-3.5 h-3.5 rounded-sm ${cell.isInRange ? tone(cell.value) : 'bg-transparent'}`}
                title={`${toDateString(cell.date)} / 来場 ${cell.value.toLocaleString()}人`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
