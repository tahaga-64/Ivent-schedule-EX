interface MobileMonthNavProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export default function MobileMonthNav({ year, month, onPrev, onNext, onToday }: MobileMonthNavProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/10 px-2 py-1.5">
      <button
        type="button"
        onClick={onPrev}
        className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-lg font-bold text-white/80 active:bg-white/10 transition-colors"
        aria-label="前の月"
      >
        ‹
      </button>
      <div className="flex flex-col items-center min-w-0 flex-1">
        <span className="text-base font-black text-white tabular-nums">{year}年{month}月</span>
        <button
          type="button"
          onClick={onToday}
          className="mt-0.5 text-[10px] font-bold text-indigo-300 active:text-indigo-200"
        >
          今月に戻る
        </button>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-lg font-bold text-white/80 active:bg-white/10 transition-colors"
        aria-label="次の月"
      >
        ›
      </button>
    </div>
  );
}
