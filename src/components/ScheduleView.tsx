import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Upload, X, Info, Save } from 'lucide-react';
import {
  fetchMonthData,
  saveMonthDataFields,
  MEMBERS,
  TRAINING_LABELS,
  TRAINING_LOCATIONS,
  TYPE_LABEL,
  TYPE_CLASS,
  getDaysInMonth,
  type StatusType,
  type MonthData,
} from '../lib/exSchedule';

// getDay() (0=日) に対応する曜日ラベル
const WEEK_JP = ['日', '月', '火', '水', '木', '金', '土'];

// 「自分の予定」で表示するメンバー名の保存キー
const MY_NAME_KEY = 'ex-schedule:my-name';

// ステータスごとの文字色。休み系はグレーで沈め、稼働は通常の白、
// イベントのみ赤で目立たせる（業務上いちばん見たい情報のため）
const STATUS_COLOR: Record<StatusType, string> = {
  normal: 'text-white/45',
  request: 'text-white/45',
  training: 'text-white/85',
  dispatch: 'text-white/85',
  standby: 'text-white/85',
  event: 'text-red-300',
  office: 'text-white/85',
  absence: 'text-white/40',
  other: 'text-white/85',
  rest: 'text-white/30',
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
    <div className="space-y-1 text-xs">
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

// ─── スケール式入力（EX-schedule の LocalInput を忠実移植） ──────────────────
// 16px で描画して transform: scale で縮小し、iOS の自動ズームを防ぎつつ
// 7〜10px 相当の極小フォントを実現する。全体表示テーブルのセル入力で使用。

function ExScaledInput({ value, onChange, className, size = 10, placeholder, list }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  size?: number;
  placeholder?: string;
  list?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => { if (!isFocused) setLocalValue(value); }, [value, isFocused]);

  const inputFontSize = 16;
  const scale = size / inputFontSize;

  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <input
        value={localValue}
        placeholder={placeholder}
        list={list}
        onChange={e => setLocalValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => { setIsFocused(false); if (localValue !== value) onChange(localValue); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="absolute top-0 left-0 origin-top-left bg-transparent border-none outline-none text-center p-0 font-bold"
        style={{
          fontSize: `${inputFontSize}px`,
          transform: `scale(${scale})`,
          width: `${(1 / scale) * 100}%`,
          height: `${(1 / scale) * 100}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 'normal',
        }}
      />
      {/* 親 div の高さ・幅を内容に合わせるための不可視プレースホルダ */}
      <div
        className="invisible select-none pointer-events-none whitespace-pre py-0.5 px-1 font-bold"
        style={{ fontSize: `${size}px`, lineHeight: 'normal' }}
      >
        {localValue || ' '}
      </div>
    </div>
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

// ─── 全体表示（EX-schedule の overall ビューを忠実再現） ──────────────────────
// PC: 全機能編集可。モバイル: 閲覧専用（入力欄は出さず静的表示）。

// getDow: 月曜=0 … 日曜=6（EX-schedule と同じ並び）
function getDow(year: number, month: number, day: number): number {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}
const WD_JP = ['月', '火', '水', '木', '金', '土', '日'];

function AllScheduleView({
  year, month, data, readOnly,
  onTypeChange, onDetailChange, onTeamGoalChange, onOverallMemoChange,
  onStationChange, onLocationChange, onTimeChange,
}: {
  year: number; month: number; data: MonthData; readOnly: boolean;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onTeamGoalChange: (val: string) => void;
  onOverallMemoChange: (val: string) => void;
  onStationChange: (member: string, val: string) => void;
  onLocationChange: (day: number, val: string) => void;
  onTimeChange: (day: number, val: string) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const dailyLocations = data.dailyLocations ?? {};
  const dailyTimes = data.dailyTimes ?? {};
  const stations = data.memberStations ?? {};

  // 「✓ 保存」表示の一時フラグ
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (id: string) => {
    setSavedFlash(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(s => (s === id ? null : s)), 1500);
  };

  const dayLabel = (type: StatusType) => TYPE_LABEL[type].split('(')[0];

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 sm:p-5 border border-border text-text">
      {/* ヘッダー: 全体稼働状況 + チーム目標 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm font-bold text-text shrink-0">
          <div className="w-1 h-4 bg-accent rounded-full" />
          全体稼働状況 ({year}年{month}月)
        </div>
        <div className="flex items-center gap-2 sm:flex-grow sm:max-w-md">
          {readOnly ? (
            <div className="w-full px-3 py-2 rounded-lg border border-accent/20 bg-accent-l/30 text-xs font-bold text-text min-h-[36px] flex items-center">
              {data.teamGoal || <span className="text-text3 font-normal">今月のチーム目標は未設定です</span>}
            </div>
          ) : (
            <>
              <LocalInput
                className="w-full px-3 py-2 rounded-lg border border-accent/20 bg-accent-l/30 focus:bg-white outline-none text-xs font-bold text-text"
                value={data.teamGoal}
                onChange={(val) => { onTeamGoalChange(val); flash('team-goal'); }}
                placeholder="今月の全体目標を入力..."
              />
              {savedFlash === 'team-goal' && (
                <span className="text-[10px] text-green-600 font-bold whitespace-nowrap">✓ 保存</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* スケジュールテーブル */}
      <div className="overflow-auto max-h-[calc(100vh-260px)] sm:max-h-[700px] -mx-3 px-3 sm:-mx-5 sm:px-5 relative border-b border-border">
        <table className="w-full text-[9px] border-separate border-spacing-0 min-w-[max-content]">
          <thead className="relative z-30">
            <tr className="bg-accent-l text-accent">
              <th className="p-1 border border-border font-bold sticky left-0 top-0 bg-accent-l z-50 min-w-[48px] text-[8px] text-left leading-tight">
                人 / 累計
              </th>
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const dow = getDow(year, month, day);
                const isSat = dow === 5;
                const isSun = dow === 6;
                return (
                  <th key={day} className={`p-0.5 border border-border font-bold text-center min-w-[42px] text-[8px] sticky top-0 z-30 ${
                    isSun ? 'text-red-600 bg-red-50' : isSat ? 'text-blue-600 bg-blue-50' : 'bg-accent-l'
                  }`}>
                    {day}({WD_JP[dow]})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* 場所 (固定表示) */}
            <tr className="bg-orange-50/30">
              <td className="p-1 border border-border sticky left-0 bg-orange-50 z-20 font-bold text-orange-800 text-[8px]">
                場所 (固定表示)
              </td>
              {Array.from({ length: totalDays }).map((_, i) => (
                <td key={i} className="p-0.5 border border-border min-w-[42px]">
                  {readOnly ? (
                    <div className="h-5 flex items-center justify-center text-center font-bold text-orange-700 text-[7.5px] truncate px-0.5">
                      {dailyLocations[i + 1] || ''}
                    </div>
                  ) : (
                    <ExScaledInput
                      className="w-full px-0.5 py-0.5 rounded border border-orange-200 outline-none focus:border-orange-500 bg-white/50 focus:bg-white h-5 text-orange-700"
                      size={7.5}
                      value={dailyLocations[i + 1] || ''}
                      onChange={(val) => onLocationChange(i + 1, val)}
                      placeholder="場所"
                    />
                  )}
                </td>
              ))}
            </tr>

            {/* 時間 (固定表示) */}
            <tr className="bg-blue-50/30">
              <td className="p-1 border border-border sticky left-0 bg-blue-50 z-20 font-bold text-blue-800 text-[8px]">
                時間 (固定表示)
              </td>
              {Array.from({ length: totalDays }).map((_, i) => (
                <td key={i} className="p-0.5 border border-border min-w-[42px]">
                  {readOnly ? (
                    <div className="h-5 flex items-center justify-center text-center font-bold text-blue-700 text-[7.5px] truncate px-0.5">
                      {dailyTimes[i + 1] || ''}
                    </div>
                  ) : (
                    <ExScaledInput
                      className="w-full px-0.5 py-0.5 rounded border border-blue-200 outline-none focus:border-blue-500 bg-white/50 focus:bg-white h-5 text-blue-700"
                      size={7.5}
                      value={dailyTimes[i + 1] || ''}
                      onChange={(val) => onTimeChange(i + 1, val)}
                      placeholder="時間"
                    />
                  )}
                </td>
              ))}
            </tr>

            {/* 稼働人数 (合計) */}
            <tr className="bg-bg/50">
              <td className="p-1 border border-border sticky left-0 bg-bg z-20 font-bold text-text text-[8px]">
                稼働人数 (合計)
              </td>
              {Array.from({ length: totalDays }).map((_, i) => {
                let count = 0;
                MEMBERS.forEach(name => {
                  const item = data.schedule[name]?.[i];
                  if (item && needsDetail(item.type)) count++;
                });
                return (
                  <td key={i} className="p-0.5 border border-border text-center font-bold text-text text-[8px] min-w-[42px]">
                    {count}人
                  </td>
                );
              })}
            </tr>

            {/* メンバー行 */}
            {MEMBERS.map(name => {
              const schedule = data.schedule[name] || [];
              const normalCount = schedule.filter(s => s.type === 'normal').length;
              const requestCount = schedule.filter(s => s.type === 'request').length;
              return (
                <tr key={name} className="hover:bg-bg/40 transition-colors">
                  <td className="p-0.5 border border-border sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-0.5">
                        <div className="font-bold text-accent text-[7.5px] truncate max-w-[32px]">{name.replace('　', '')}</div>
                        <div className="flex flex-col text-[6px] font-bold leading-tight shrink-0">
                          <span className="text-gray-400">公{normalCount}</span>
                          <span className="text-pink-400">希{requestCount}</span>
                        </div>
                      </div>
                      {readOnly ? (
                        <div className="h-2.5 flex items-center text-[6.5px] text-text2 truncate px-0.5">
                          {stations[name] || ''}
                        </div>
                      ) : (
                        <ExScaledInput
                          className="w-full px-0.5 py-0 rounded border border-accent/10 outline-none focus:border-accent bg-white/50 h-2.5 text-text"
                          size={6.5}
                          value={stations[name] || ''}
                          onChange={(val) => onStationChange(name, val)}
                          placeholder="駅"
                        />
                      )}
                    </div>
                  </td>
                  {Array.from({ length: totalDays }).map((_, di) => {
                    const item = data.schedule[name]?.[di] ?? { type: 'rest' as StatusType, detail: '' };
                    return (
                      <td key={di} className="p-0.5 border border-border min-w-[42px]">
                        {readOnly ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className={`w-full text-center rounded-full text-[8px] font-bold px-0.5 py-0.5 ${TYPE_CLASS[item.type]}`}>
                              {dayLabel(item.type)}
                            </span>
                            {item.detail && needsDetail(item.type) && (
                              <span className="w-full text-center text-[7.5px] text-text2 truncate">{item.detail}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 min-w-full w-max text-center justify-center mx-auto">
                            <select
                              className={`w-full px-0.5 py-0.5 rounded-full text-[8px] font-bold outline-none border border-transparent focus:border-accent/30 transition-all ${TYPE_CLASS[item.type]}`}
                              value={item.type}
                              onChange={(e) => onTypeChange(name, di, e.target.value as StatusType)}
                            >
                              {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                                <option key={t} value={t}>{dayLabel(t)}</option>
                              ))}
                            </select>
                            <ExScaledInput
                              className="min-w-full w-max px-0.5 py-0.5 rounded border border-border outline-none focus:border-accent bg-white/50 focus:bg-white h-4 text-text2"
                              size={7.5}
                              value={item.detail || ''}
                              onChange={(val) => onDetailChange(name, di, val)}
                              placeholder="..."
                              list="schedule-suggestions"
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 全体メモ / 連絡事項 */}
      <div className="mt-6 bg-accent-l/20 rounded-xl p-4 sm:p-5 border border-accent/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <Info size={14} />
            全体メモ / 連絡事項
          </div>
          {!readOnly && (
            <button
              onClick={() => { onOverallMemoChange(data.overallMemo ?? ''); flash('overall-memo'); }}
              className="bg-accent text-white px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-accent-d transition-colors"
            >
              <Save size={12} />
              メモを保存
            </button>
          )}
        </div>
        {readOnly ? (
          <div className="w-full border border-accent/20 rounded-xl p-4 text-xs bg-white min-h-[120px] leading-relaxed font-bold text-text whitespace-pre-wrap">
            {data.overallMemo || <span className="text-text3 font-normal">連絡事項はありません</span>}
          </div>
        ) : (
          <LocalTextarea
            className="w-full border border-accent/20 rounded-xl p-4 text-xs bg-white focus:border-accent outline-none min-h-[150px] leading-relaxed font-bold text-text"
            value={data.overallMemo ?? ''}
            onChange={onOverallMemoChange}
            placeholder="全体に向けた連絡事項や、月間の特記事項を入力してください..."
            rows={5}
          />
        )}
        {savedFlash === 'overall-memo' && (
          <div className="mt-2 text-right text-[10px] text-green-600 font-bold">
            ✓ 全体メモを保存しました
          </div>
        )}
      </div>

      {!readOnly && <ScheduleSuggestions trainingLabels={data.trainingLabels} />}
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
    const mergeKeys = ['schedule', 'memos', 'dones', 'memberStations', 'dailyLocations', 'dailyTimes'];
    for (const [key, val] of Object.entries(updates)) {
      const prevVal = pending[key];
      if (
        mergeKeys.includes(key) &&
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

  const handleStationChange = useCallback((member: string, val: string) => {
    if (readOnly) return;
    setData(prev => prev ? { ...prev, memberStations: { ...(prev.memberStations ?? {}), [member]: val } } : prev);
    persistChanges({ memberStations: { [member]: val } });
  }, [persistChanges, readOnly]);

  const handleLocationChange = useCallback((day: number, val: string) => {
    if (readOnly) return;
    setData(prev => prev ? { ...prev, dailyLocations: { ...(prev.dailyLocations ?? {}), [day]: val } } : prev);
    persistChanges({ dailyLocations: { [day]: val } });
  }, [persistChanges, readOnly]);

  const handleTimeChange = useCallback((day: number, val: string) => {
    if (readOnly) return;
    setData(prev => prev ? { ...prev, dailyTimes: { ...(prev.dailyTimes ?? {}), [day]: val } } : prev);
    persistChanges({ dailyTimes: { [day]: val } });
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
            { id: 'all', label: '全体表示' },
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
            onStationChange={handleStationChange}
            onLocationChange={handleLocationChange}
            onTimeChange={handleTimeChange}
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
