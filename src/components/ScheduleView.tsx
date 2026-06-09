import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Upload, X } from 'lucide-react';
import {
  fetchMonthData,
  saveMonthDataFields,
  MEMBERS,
  TRAINING_LABELS,
  TRAINING_LOCATIONS,
  TYPE_LABEL,
  getDaysInMonth,
  type StatusType,
  type MonthData,
} from '../lib/exSchedule';

// getDay() (0=日) に対応する曜日ラベル
const WEEK_JP = ['日', '月', '火', '水', '木', '金', '土'];

// 「自分の予定」で表示するメンバー名の保存キー
const MY_NAME_KEY = 'ex-schedule:my-name';

// ステータスごとの文字色（ダーク背景向け・控えめな配色）
const STATUS_COLOR: Record<StatusType, string> = {
  normal: 'text-white/50',
  request: 'text-pink-300',
  training: 'text-violet-300',
  dispatch: 'text-orange-300',
  standby: 'text-amber-300',
  event: 'text-red-300',
  office: 'text-emerald-300',
  absence: 'text-white/35',
  other: 'text-sky-300',
  rest: 'text-white/25',
};

// ─── 画面幅検出（モバイル = 閲覧専用） ───────────────────────────────────────

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

// detail を入力・表示すべきステータスか（= 稼働扱い）
function needsDetail(type: StatusType): boolean {
  return type !== 'normal' && type !== 'request' && type !== 'rest';
}

// 一覧セル・行に表示する短いテキスト（〇 → 公休、◎ → 希望休 と表記する）
function displayText(item: { type: StatusType; detail: string }): string {
  if (item.type === 'normal') return '公休';
  if (item.type === 'request') return '希望休';
  if (item.type === 'rest') return item.detail === '未定' ? '未定' : item.detail || '－';
  return item.detail || TYPE_LABEL[item.type];
}

// ─── 1日分の詳細情報（モバイル: タップ展開 / デスクトップ: ホバー表示） ──────

type DayInfo = {
  type: StatusType;
  typeLabel: string;
  detail: string;
  trainingName?: string;
  trainingLocation?: string;
  memo?: string;
};

function dayInfo(data: MonthData, member: string, dayIdx: number): DayInfo {
  const item = data.schedule[member]?.[dayIdx] ?? { type: 'rest' as StatusType, detail: '' };
  const labels = data.trainingLabels ?? TRAINING_LABELS;
  const locations = data.trainingLocations ?? TRAINING_LOCATIONS;
  const key = (item.detail ?? '').trim();
  return {
    type: item.type,
    typeLabel: TYPE_LABEL[item.type].replace('(〇)', '').replace('(◎)', ''),
    detail: item.detail,
    trainingName: labels[key] || undefined,
    trainingLocation: locations[key] || undefined,
    memo: data.memos[member]?.[dayIdx + 1] || undefined,
  };
}

function DayDetail({ info }: { info: DayInfo }) {
  const rows: { label: string; value: string; className?: string }[] = [
    { label: '区分', value: info.typeLabel, className: STATUS_COLOR[info.type] },
  ];
  if (needsDetail(info.type) && info.detail) {
    rows.push({ label: '内容', value: info.trainingName ? `${info.detail}（${info.trainingName}）` : info.detail });
  }
  if (info.trainingLocation) rows.push({ label: '場所', value: info.trainingLocation });
  if (info.memo) rows.push({ label: 'メモ', value: info.memo });
  return (
    <div className="border-l-2 border-white/15 pl-3 space-y-1 text-xs">
      {rows.map(r => (
        <div key={r.label} className="flex gap-2">
          <span className="w-8 shrink-0 text-white/40">{r.label}</span>
          <span className={r.className ?? 'text-white/85'}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ローカル入力（iOS ズーム防止のため 16px 固定・onBlur で確定） ───────────

function LocalInput({ value, onChange, className, placeholder, list }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  list?: string;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(value); }, [value, focused]);
  return (
    <input
      className={className}
      style={{ fontSize: 16 }}
      value={local}
      list={list}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (local !== value) onChange(local); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

function LocalTextarea({ value, onChange, className, placeholder, rows = 2 }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(value); }, [value, focused]);
  return (
    <textarea
      className={className}
      style={{ fontSize: 16 }}
      rows={rows}
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); if (local !== value) onChange(local); }}
    />
  );
}

// ─── 詳細入力の候補リスト ─────────────────────────────────────────────────────

function ScheduleSuggestions({ trainingLabels }: { trainingLabels?: Record<string, string> }) {
  return (
    <datalist id="schedule-suggestions">
      {Object.keys(trainingLabels ?? TRAINING_LABELS).map(k => (
        <option key={k} value={k} />
      ))}
      <option value="待機(海浜幕張)" />
      <option value="待機(鳥浜)" />
      <option value="海浜幕張" />
      <option value="鳥浜" />
      <option value="外販ミステリー1" />
      <option value="イベントメンバー選抜" />
      <option value="VR" />
      <option value="販売" />
    </datalist>
  );
}

// ─── 一括インポートモーダル（デスクトップのみ） ──────────────────────────────

function BulkImportModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (data: Record<string, string[]>) => void;
}) {
  const [text, setText] = useState('');

  const handleImport = () => {
    if (!text.trim()) return;
    const lines = text.trim().split('\n');
    const result: Record<string, string[]> = {};
    const norm = (n: string) => n.replace(/[\s　]+/g, '').trim();
    const normMembers = MEMBERS.map(norm);

    lines.forEach(line => {
      const parts = line.split('\t');
      if (parts.length <= 1) return;
      const name = parts[0].trim();
      const idx = normMembers.indexOf(norm(name));
      if (idx !== -1) {
        result[MEMBERS[idx]] = parts.slice(1).map(p => p.trim());
      }
    });

    if (Object.keys(result).length === 0) {
      alert('有効なメンバー名が見つかりませんでした。スプレッドシートから名前を含めてコピーしてください。');
      return;
    }
    onImport(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-900 border border-white/15 rounded-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">一括インポート</h2>
            <p className="text-xs text-white/50 mt-0.5">スプレッドシートからコピーしたデータを貼り付けてください。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <ol className="list-decimal list-inside text-xs text-white/60 leading-relaxed space-y-0.5">
            <li>Googleスプレッドシートを開きます。</li>
            <li>名前の列から日付の列まで選択してコピー（Ctrl+C）します。</li>
            <li>下のテキストエリアに貼り付け（Ctrl+V）ます。</li>
            <li>「インポート実行」をクリックします。</li>
          </ol>
          <LocalTextarea
            className="w-full h-48 border border-white/15 rounded p-3 text-xs font-mono bg-slate-950 text-white/80 focus:border-white/40 outline-none resize-none"
            placeholder={'ここに貼り付けてください...\n例:\n加藤 あかり\t研修1\t〇\t研修2...'}
            value={text}
            onChange={setText}
            rows={10}
          />
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-white/60 hover:text-white hover:bg-white/10">
            キャンセル
          </button>
          <button onClick={handleImport} className="px-5 py-2 rounded text-sm font-bold bg-white text-slate-900 hover:bg-white/90">
            インポート実行
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 名前選択（初回のみ） ─────────────────────────────────────────────────────

function NamePicker({ onSelect }: { onSelect: (name: string) => void }) {
  return (
    <div className="max-w-md mx-auto py-8">
      <p className="text-sm text-white/70 mb-1">自分の名前を選択してください。</p>
      <p className="text-xs text-white/40 mb-5">この端末に保存され、次回から自動で表示されます。</p>
      <div className="grid grid-cols-2 gap-2">
        {MEMBERS.map(name => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="h-11 px-3 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-sm text-white/85 text-left"
          >
            {name.replace('　', ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 研修・イベント詳細（折りたたみ） ────────────────────────────────────────

function TrainingInfo({ data }: { data: MonthData }) {
  const [open, setOpen] = useState(false);
  const labels = data.trainingLabels ?? TRAINING_LABELS;
  const locations = data.trainingLocations ?? TRAINING_LOCATIONS;
  const keys = Object.keys(labels).filter(k => labels[k]);
  if (keys.length === 0) return null;

  return (
    <div className="border border-white/10 rounded">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-bold text-white/70">研修・イベント詳細</span>
        <span className="text-xs text-white/40">{open ? '閉じる' : '表示'}</span>
      </button>
      {open && (
        <table className="w-full text-xs border-t border-white/10">
          <tbody>
            {keys.map(key => (
              <tr key={key} className="border-b border-white/5 last:border-b-0">
                <td className="px-3 py-2 text-violet-300 whitespace-nowrap w-16">{key}</td>
                <td className="px-2 py-2 text-white/80 whitespace-nowrap">{labels[key]}</td>
                <td className="px-3 py-2 text-white/45">{locations[key] || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── 自分の予定 ──────────────────────────────────────────────────────────────

function MyScheduleView({
  year, month, member, data, readOnly,
  onTypeChange, onDetailChange, onMemoChange, onChangeName,
}: {
  year: number; month: number; member: string; data: MonthData; readOnly: boolean;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onMemoChange: (member: string, day: number, val: string) => void;
  onChangeName: () => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  // タップで詳細を開いている日（モバイル）
  const [openDay, setOpenDay] = useState<number | null>(null);

  // 月間サマリー（稼働・公休・希望休の日数）
  let workDays = 0, offDays = 0, requestDays = 0;
  for (let i = 0; i < totalDays; i++) {
    const t = data.schedule[member]?.[i]?.type;
    if (!t) continue;
    if (needsDetail(t)) workDays++;
    else if (t === 'normal') offDays++;
    else if (t === 'request') requestDays++;
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-sm font-bold text-white shrink-0">{member.replace('　', ' ')}</span>
          <span className="text-xs text-white/45 tabular-nums truncate">
            稼働 {workDays}日 ・ 公休 {offDays}日 ・ 希望休 {requestDays}日
          </span>
        </div>
        <button onClick={onChangeName} className="shrink-0 text-xs text-white/40 hover:text-white/70 underline underline-offset-2">
          名前を変更
        </button>
      </div>

      <TrainingInfo data={data} />

      <div className="border border-white/10 rounded divide-y divide-white/5">
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dow = new Date(year, month - 1, day).getDay();
          const isToday = isCurrentMonth && day === now.getDate();
          const item = data.schedule[member]?.[i] ?? { type: 'rest' as StatusType, detail: '' };
          const memo = data.memos[member]?.[day] ?? '';
          const info = dayInfo(data, member, i);

          const dayLabel = (
            <span className={`w-14 shrink-0 text-sm tabular-nums ${
              dow === 0 ? 'text-red-300' : dow === 6 ? 'text-blue-300' : 'text-white/60'
            }`}>
              {day}日（{WEEK_JP[dow]}）
            </span>
          );

          // モバイル: 行をタップでその日の詳細を展開
          if (readOnly) {
            const open = openDay === day;
            return (
              <div key={day} className={isToday ? 'bg-white/8' : ''}>
                <button
                  onClick={() => setOpenDay(open ? null : day)}
                  className="w-full px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-3">
                    {dayLabel}
                    <span className={`flex-1 text-sm truncate ${STATUS_COLOR[item.type]}`}>
                      {displayText(item)}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </div>
                  {memo && !open && (
                    <div className="mt-1 pl-[68px] text-xs text-white/45 truncate">{memo}</div>
                  )}
                </button>
                {open && (
                  <div className="px-3 pb-3 pl-[80px]">
                    <DayDetail info={info} />
                  </div>
                )}
              </div>
            );
          }

          // デスクトップ: インライン編集
          return (
            <div key={day} className={`px-3 py-2 ${isToday ? 'bg-white/8' : ''}`}>
              <div className="flex items-center gap-3">
                {dayLabel}
                <select
                  value={item.type}
                  onChange={e => onTypeChange(member, i, e.target.value as StatusType)}
                  className="h-8 w-32 shrink-0 rounded border border-white/15 bg-slate-800 text-white text-xs px-1 outline-none"
                >
                  {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                    <option key={t} value={t}>{TYPE_LABEL[t].replace('(〇)', '').replace('(◎)', '')}</option>
                  ))}
                </select>
                {needsDetail(item.type) && (
                  <>
                    <LocalInput
                      className="flex-1 h-8 px-2 rounded border border-white/15 bg-white/5 text-white/85 outline-none focus:border-white/40"
                      value={item.detail}
                      onChange={v => onDetailChange(member, i, v)}
                      placeholder="詳細"
                      list="schedule-suggestions"
                    />
                    {info.trainingName && (
                      <span className="shrink-0 max-w-[200px] truncate text-xs text-white/45">
                        {info.trainingName}{info.trainingLocation ? `・${info.trainingLocation}` : ''}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="mt-1.5 pl-[68px]">
                <LocalInput
                  className="w-full h-8 px-2 rounded border border-white/10 bg-transparent text-white/60 outline-none focus:border-white/30"
                  value={memo}
                  onChange={v => onMemoChange(member, day, v)}
                  placeholder="メモ"
                />
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && <ScheduleSuggestions trainingLabels={data.trainingLabels} />}
    </div>
  );
}

// ─── 全員の予定 ──────────────────────────────────────────────────────────────

function AllScheduleView({
  year, month, data, readOnly,
  onTypeChange, onDetailChange, onTeamGoalChange, onOverallMemoChange,
}: {
  year: number; month: number; data: MonthData; readOnly: boolean;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onTeamGoalChange: (val: string) => void;
  onOverallMemoChange: (val: string) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const [editMode, setEditMode] = useState(false);
  const [selDay, setSelDay] = useState(isCurrentMonth ? now.getDate() : 1);
  // タップで詳細を開いているメンバー（モバイル）
  const [openMember, setOpenMember] = useState<string | null>(null);
  // ホバー中のセル（デスクトップ・表示モードのみ）
  const [hover, setHover] = useState<{
    x: number; top: number; bottom: number; member: string; di: number;
  } | null>(null);

  useEffect(() => {
    setSelDay(d => Math.min(Math.max(1, d), totalDays));
  }, [totalDays]);

  const activeCount = (di: number) =>
    MEMBERS.reduce((n, name) => {
      const it = data.schedule[name]?.[di];
      return n + (it && needsDetail(it.type) ? 1 : 0);
    }, 0);

  // ── モバイル: 日付選択 + 当日の全員一覧（閲覧専用） ──
  if (readOnly) {
    const di = selDay - 1;
    return (
      <div className="space-y-3">
        {data.teamGoal && (
          <div className="border border-white/10 rounded px-3 py-2.5">
            <div className="text-xs text-white/40 mb-0.5">今月のチーム目標</div>
            <div className="text-sm text-white/85">{data.teamGoal}</div>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = i + 1;
            const w = new Date(year, month - 1, d).getDay();
            const sel = d === selDay;
            const today = isCurrentMonth && d === now.getDate();
            return (
              <button
                key={d}
                onClick={() => { setSelDay(d); setOpenMember(null); }}
                className={`flex flex-col items-center justify-center min-w-[44px] h-12 rounded border shrink-0 ${
                  sel ? 'bg-white text-slate-900 border-white'
                    : today ? 'border-white/40 text-white bg-white/5'
                    : 'border-white/10 text-white/60'
                }`}
              >
                <span className="text-sm tabular-nums leading-none">{d}</span>
                <span className={`text-[10px] mt-0.5 ${
                  sel ? 'text-slate-600' : w === 0 ? 'text-red-300/80' : w === 6 ? 'text-blue-300/80' : 'text-white/35'
                }`}>{WEEK_JP[w]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-bold text-white">
            {month}月{selDay}日（{WEEK_JP[new Date(year, month - 1, selDay).getDay()]}）
          </span>
          <span className="text-xs text-white/50">稼働 {activeCount(di)}名</span>
        </div>

        <div className="border border-white/10 rounded divide-y divide-white/5">
          {MEMBERS.map(name => {
            const item = data.schedule[name]?.[di] ?? { type: 'rest' as StatusType, detail: '' };
            const open = openMember === name;
            return (
              <div key={name}>
                <button
                  onClick={() => setOpenMember(open ? null : name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span className="flex-1 text-sm text-white/80 truncate">{name.replace('　', ' ')}</span>
                  <span className={`text-sm text-right ${STATUS_COLOR[item.type]}`}>
                    {displayText(item)}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`shrink-0 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                {open && (
                  <div className="px-3 pb-3">
                    <DayDetail info={dayInfo(data, name, di)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.overallMemo && (
          <div className="border border-white/10 rounded px-3 py-2.5">
            <div className="text-xs text-white/40 mb-1">全体メモ / 連絡事項</div>
            <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{data.overallMemo}</div>
          </div>
        )}
      </div>
    );
  }

  // ── デスクトップ: 月全体テーブル（表示専用 ⇄ 編集モード） ──
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 border border-white/10 rounded px-3 py-2">
          <div className="text-xs text-white/40 mb-1">今月のチーム目標</div>
          <LocalInput
            className="w-full bg-transparent text-sm text-white/85 outline-none border-b border-transparent focus:border-white/30"
            value={data.teamGoal}
            onChange={onTeamGoalChange}
            placeholder="今月の全体目標を入力..."
          />
        </div>
        <button
          onClick={() => { setEditMode(v => !v); setHover(null); }}
          className={`h-9 px-4 rounded border text-sm shrink-0 ${
            editMode
              ? 'bg-white text-slate-900 border-white font-bold'
              : 'border-white/20 text-white/70 hover:text-white hover:border-white/40'
          }`}
        >
          {editMode ? '編集を終了' : '編集'}
        </button>
      </div>

      <div className="border border-white/10 rounded overflow-hidden">
        <div className="overflow-auto max-h-[65vh]" onScroll={() => setHover(null)}>
          <table className="border-collapse text-xs" style={{ minWidth: `${120 + totalDays * (editMode ? 88 : 56)}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900">
                <th className="sticky left-0 z-30 bg-slate-900 px-3 py-2 text-left border-b border-r border-white/10 font-normal text-white/40">
                  名前
                </th>
                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = i + 1;
                  const dow = new Date(year, month - 1, day).getDay();
                  const isToday = isCurrentMonth && day === now.getDate();
                  return (
                    <th key={day} className={`px-1 py-1.5 text-center border-b border-white/10 font-normal ${isToday ? 'bg-white/10' : ''}`}>
                      <div className={dow === 0 ? 'text-red-300' : dow === 6 ? 'text-blue-300' : 'text-white/60'}>{day}</div>
                      <div className={`text-[10px] ${dow === 0 ? 'text-red-300/60' : dow === 6 ? 'text-blue-300/60' : 'text-white/30'}`}>
                        {WEEK_JP[dow]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5 border-r border-b border-white/10 text-white/40">
                  稼働人数
                </td>
                {Array.from({ length: totalDays }).map((_, i) => {
                  const c = activeCount(i);
                  return (
                    <td key={i} className="px-1 py-1.5 text-center border-b border-white/10 text-white/70 tabular-nums">
                      {c > 0 ? c : ''}
                    </td>
                  );
                })}
              </tr>

              {MEMBERS.map(name => (
                <tr key={name}>
                  <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5 border-r border-b border-white/5 text-white/75 whitespace-nowrap">
                    {name.replace('　', ' ')}
                  </td>
                  {Array.from({ length: totalDays }).map((_, di) => {
                    const item = data.schedule[name]?.[di] ?? { type: 'rest' as StatusType, detail: '' };
                    const dow = new Date(year, month - 1, di + 1).getDay();
                    const isToday = isCurrentMonth && (di + 1) === now.getDate();
                    const bg = isToday ? 'bg-white/8' : dow === 0 ? 'bg-red-500/5' : dow === 6 ? 'bg-blue-500/5' : '';

                    return (
                      <td key={di} className={`border-b border-white/5 align-top ${bg} ${editMode ? 'px-1 py-1' : 'px-1.5 py-1.5'}`}>
                        {editMode ? (
                          <div className="flex flex-col gap-1" style={{ width: 80 }}>
                            <select
                              value={item.type}
                              onChange={e => onTypeChange(name, di, e.target.value as StatusType)}
                              className="w-full h-7 rounded border border-white/15 bg-slate-800 text-white text-[11px] px-0.5 outline-none"
                            >
                              {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                                <option key={t} value={t}>{TYPE_LABEL[t].replace('(〇)', '').replace('(◎)', '')}</option>
                              ))}
                            </select>
                            {needsDetail(item.type) && (
                              <LocalInput
                                className="w-full h-7 px-1 rounded border border-white/10 bg-white/5 text-white/80 outline-none focus:border-white/40"
                                value={item.detail}
                                onChange={v => onDetailChange(name, di, v)}
                                placeholder="詳細"
                                list="schedule-suggestions"
                              />
                            )}
                          </div>
                        ) : (
                          <div
                            className={`text-center whitespace-nowrap overflow-hidden text-ellipsis ${STATUS_COLOR[item.type]}`}
                            style={{ maxWidth: 72 }}
                            onMouseEnter={e => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setHover({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom, member: name, di });
                            }}
                            onMouseLeave={() => setHover(null)}
                          >
                            {displayText(item)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ホバー詳細（fixed 配置で overflow にクリップされない） */}
      {!editMode && hover && (() => {
        const info = dayInfo(data, hover.member, hover.di);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.min(Math.max(hover.x, 140), vw - 140);
        const showBelow = hover.bottom + 170 < vh;
        return (
          <div
            className="fixed z-[150] w-64 -translate-x-1/2 rounded border border-white/20 bg-slate-900 px-3 py-2.5 text-xs shadow-xl pointer-events-none"
            style={showBelow ? { left, top: hover.bottom + 6 } : { left, bottom: vh - hover.top + 6 }}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="font-bold text-white truncate">{hover.member.replace('　', ' ')}</span>
              <span className="shrink-0 text-white/45 tabular-nums">
                {month}月{hover.di + 1}日（{WEEK_JP[new Date(year, month - 1, hover.di + 1).getDay()]}）
              </span>
            </div>
            <DayDetail info={info} />
          </div>
        );
      })()}

      <div className="border border-white/10 rounded px-3 py-2.5">
        <div className="text-xs text-white/40 mb-1.5">全体メモ / 連絡事項</div>
        <LocalTextarea
          className="w-full bg-transparent text-sm text-white/75 outline-none resize-none leading-relaxed min-h-[72px]"
          value={data.overallMemo ?? ''}
          onChange={onOverallMemoChange}
          placeholder="全体に向けた連絡事項や月間の特記事項を入力してください..."
          rows={3}
        />
      </div>

      <ScheduleSuggestions trainingLabels={data.trainingLabels} />
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function ScheduleView() {
  const isMobile = useIsMobile();
  const readOnly = isMobile; // スマホは閲覧専用
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [myName, setMyName] = useState<string | null>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(MY_NAME_KEY) : null;
    return stored && MEMBERS.includes(stored) ? stored : null;
  });
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // デバウンス中の保留更新を蓄積（連続編集で前の変更を失わないため）
  const pendingRef = useRef<Record<string, unknown>>({});

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const result = await fetchMonthData(y, m);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(year, month); }, [year, month, load]);

  const persistChanges = useCallback((updates: Partial<MonthData> & Record<string, unknown>) => {
    // schedule / memos などのマップは深くマージし、別メンバーへの
    // 連続編集が互いを上書きしないようにする。
    const pending = pendingRef.current;
    for (const [key, val] of Object.entries(updates)) {
      const prevVal = pending[key];
      if (
        (key === 'schedule' || key === 'memos' || key === 'dones') &&
        val && typeof val === 'object' && !Array.isArray(val) &&
        prevVal && typeof prevVal === 'object' && !Array.isArray(prevVal)
      ) {
        pending[key] = { ...(prevVal as object), ...(val as object) };
      } else {
        pending[key] = val;
      }
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const toSave = pendingRef.current;
      pendingRef.current = {};
      if (Object.keys(toSave).length === 0) return;
      setSaving(true);
      try {
        await saveMonthDataFields(year, month, toSave);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [year, month]);

  const handleTypeChange = useCallback((member: string, dayIdx: number, type: StatusType) => {
    if (readOnly) return;
    setData(prev => {
      if (!prev) return prev;
      const memberSched = [...(prev.schedule[member] ?? [])];
      memberSched[dayIdx] = { ...memberSched[dayIdx], type };
      const newSched = { ...prev.schedule, [member]: memberSched };
      persistChanges({ schedule: { [member]: memberSched } });
      return { ...prev, schedule: newSched };
    });
  }, [persistChanges, readOnly]);

  const handleDetailChange = useCallback((member: string, dayIdx: number, detail: string) => {
    if (readOnly) return;
    setData(prev => {
      if (!prev) return prev;
      const memberSched = [...(prev.schedule[member] ?? [])];
      memberSched[dayIdx] = { ...memberSched[dayIdx], detail };
      const newSched = { ...prev.schedule, [member]: memberSched };
      persistChanges({ schedule: { [member]: memberSched } });
      return { ...prev, schedule: newSched };
    });
  }, [persistChanges, readOnly]);

  const handleMemoChange = useCallback((member: string, day: number, val: string) => {
    if (readOnly) return;
    setData(prev => {
      if (!prev) return prev;
      const newMemos = { ...prev.memos, [member]: { ...(prev.memos[member] ?? {}), [day]: val } };
      persistChanges({ memos: newMemos });
      return { ...prev, memos: newMemos };
    });
  }, [persistChanges, readOnly]);

  const handleTeamGoalChange = useCallback((val: string) => {
    if (readOnly) return;
    setData(prev => prev ? { ...prev, teamGoal: val } : prev);
    persistChanges({ teamGoal: val });
  }, [persistChanges, readOnly]);

  const handleOverallMemoChange = useCallback((val: string) => {
    if (readOnly) return;
    setData(prev => prev ? { ...prev, overallMemo: val } : prev);
    persistChanges({ overallMemo: val });
  }, [persistChanges, readOnly]);

  const handleBulkImport = useCallback((importedData: Record<string, string[]>) => {
    if (!data || readOnly) return;
    const totalDays = getDaysInMonth(year, month);
    const newSched = { ...data.schedule };

    Object.entries(importedData).forEach(([member, rawDays]) => {
      let parsed = rawDays.map(s => {
        if (s === '〇') return { type: 'normal' as StatusType, detail: s };
        if (s === '◎') return { type: 'request' as StatusType, detail: s };
        if (s.startsWith('研修')) return { type: 'training' as StatusType, detail: s };
        if (s.includes('待機')) return { type: 'standby' as StatusType, detail: s };
        if (s.includes('イベント')) return { type: 'event' as StatusType, detail: s };
        if (s === '未定' || s === '') return { type: 'rest' as StatusType, detail: s };
        return { type: 'other' as StatusType, detail: s };
      });
      if (parsed.length < totalDays) {
        parsed = [...parsed, ...Array(totalDays - parsed.length).fill({ type: 'rest' as StatusType, detail: '' })];
      } else {
        parsed = parsed.slice(0, totalDays);
      }
      newSched[member] = parsed;
    });

    setData(prev => prev ? { ...prev, schedule: newSched } : prev);
    persistChanges({ schedule: newSched });
  }, [data, year, month, persistChanges, readOnly]);

  const handleResetMonth = () => {
    if (readOnly) return;
    if (!window.confirm(`${year}年${month}月のスケジュールを全て空欄にリセットしますか？`)) return;
    const totalDays = getDaysInMonth(year, month);
    const blankSched: MonthData['schedule'] = {};
    for (const member of MEMBERS) {
      blankSched[member] = Array(totalDays).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
    }
    setData(prev => prev ? { ...prev, schedule: blankSched, trainingLabels: {}, trainingLocations: {} } : prev);
    persistChanges({ schedule: blankSched, trainingLabels: {}, trainingLocations: {} });
  };

  const selectMyName = (name: string) => {
    localStorage.setItem(MY_NAME_KEY, name);
    setMyName(name);
  };
  const clearMyName = () => {
    localStorage.removeItem(MY_NAME_KEY);
    setMyName(null);
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="flex flex-col h-full min-h-0 text-white">
      {/* ヘッダー */}
      <div className="shrink-0 pb-3 border-b border-white/10 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <span className="text-base font-bold text-white tabular-nums min-w-[6.5rem] text-center">
              {year}年{month}月
            </span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
            className="px-3 h-8 rounded border border-white/15 text-white/60 hover:text-white text-xs"
          >
            今月
          </button>

          <button
            onClick={() => load(year, month)}
            className={`w-8 h-8 flex items-center justify-center rounded border border-white/15 text-white/50 hover:text-white ${loading ? 'animate-spin' : ''}`}
            aria-label="再読み込み"
          >
            <RefreshCw size={13} />
          </button>

          {saving && <span className="text-xs text-white/50">保存中...</span>}

          {!readOnly && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 h-8 rounded border border-white/15 text-white/60 hover:text-white text-xs"
              >
                <Upload size={12} /> 一括インポート
              </button>
              <button
                onClick={handleResetMonth}
                className="px-3 h-8 rounded border border-white/15 text-white/40 hover:text-red-300 hover:border-red-300/40 text-xs"
              >
                月をリセット
              </button>
            </div>
          )}
        </div>

        {/* タブ */}
        <div className="flex gap-5 border-b border-white/10 -mb-3">
          {([
            { id: 'my', label: '自分の予定' },
            { id: 'all', label: '全員の予定' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-sm border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-white text-white font-bold'
                  : 'border-transparent text-white/45 hover:text-white/75'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pb-8">
        {loading ? (
          <div className="py-20 text-center text-white/40 text-sm">読み込み中...</div>
        ) : !data ? (
          <div className="py-20 text-center text-white/40 text-sm space-y-2">
            <div>データを読み込めませんでした</div>
            <button onClick={() => load(year, month)} className="text-white/70 underline underline-offset-2">再試行</button>
          </div>
        ) : activeTab === 'my' ? (
          myName ? (
            <MyScheduleView
              year={year} month={month} member={myName} data={data} readOnly={readOnly}
              onTypeChange={handleTypeChange}
              onDetailChange={handleDetailChange}
              onMemoChange={handleMemoChange}
              onChangeName={clearMyName}
            />
          ) : (
            <NamePicker onSelect={selectMyName} />
          )
        ) : (
          <AllScheduleView
            year={year} month={month} data={data} readOnly={readOnly}
            onTypeChange={handleTypeChange}
            onDetailChange={handleDetailChange}
            onTeamGoalChange={handleTeamGoalChange}
            onOverallMemoChange={handleOverallMemoChange}
          />
        )}
      </div>

      {/* 一括インポートモーダル（デスクトップのみ） */}
      {!readOnly && showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onImport={(d) => { handleBulkImport(d); setShowImport(false); }}
        />
      )}
    </div>
  );
}
