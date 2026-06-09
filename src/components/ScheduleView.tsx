import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Save, Upload, X, Info, RefreshCw } from 'lucide-react';
import {
  fetchMonthData,
  saveMonthDataFields,
  MEMBERS,
  TRAINING_LABELS,
  TRAINING_LOCATIONS,
  TYPE_LABEL,
  TYPE_CLASS,
  getDaysInMonth,
  getStartOffset,
  type StatusType,
  type MonthData,
} from '../lib/exSchedule';

const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日'];
// getDay() (0=日) に対応する曜日ラベル
const WEEK_JP = ['日', '月', '火', '水', '木', '金', '土'];

// ─── 画面幅検出（モバイル/デスクトップ出し分け） ─────────────────────────────
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

// ─── ローカル入力コンポーネント ───────────────────────────────────────────────
// iOS での自動ズーム防止のため 16px スケールトリックを使用

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

// ─── 一括インポートモーダル ───────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-indigo-600/30">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Upload size={18} /> 一括インポート
            </h2>
            <p className="text-xs text-white/60 mt-0.5">スプレッドシートからコピーしたデータを貼り付けてください。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-3 text-xs text-blue-300 leading-relaxed">
            <p className="font-bold mb-1">貼り付け方法:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Googleスプレッドシートを開きます。</li>
              <li>名前の列から日付の列まで選択してコピー（Ctrl+C）します。</li>
              <li>下のテキストエリアに貼り付け（Ctrl+V）ます。</li>
              <li>「インポート実行」をクリックします。</li>
            </ol>
          </div>
          <LocalTextarea
            className="w-full h-48 border border-white/20 rounded-xl p-3 text-xs font-mono bg-slate-800 text-white/80 focus:border-indigo-400 outline-none resize-none"
            placeholder={'ここに貼り付けてください...\n例:\n加藤 あかり\t研修1\t〇\t研修2...'}
            value={text}
            onChange={setText}
            rows={10}
          />
        </div>
        <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-slate-900/80">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            キャンセル
          </button>
          <button onClick={handleImport} className="px-6 py-2 rounded-xl text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            インポート実行
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 共通: 詳細入力の候補リスト ───────────────────────────────────────────────

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

// detail を表示すべきステータスか
function needsDetail(type: StatusType): boolean {
  return type !== 'normal' && type !== 'request' && type !== 'rest';
}

// 稼働中（公休/希望休/未定 以外）か
function isActive(type: StatusType): boolean {
  return needsDetail(type);
}

// ─── メンバービュー モバイル版（縦アジェンダ） ───────────────────────────────

function MemberAgendaList({
  year, month, member, data,
  onTypeChange, onDetailChange, onMemoChange, onDoneChange,
}: {
  year: number; month: number; member: string; data: MonthData;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onMemoChange: (member: string, day: number, val: string) => void;
  onDoneChange: (member: string, day: number, checked: boolean) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const now = new Date();
  const trainingLabels = data.trainingLabels ?? TRAINING_LABELS;
  const trainingLocations = data.trainingLocations ?? TRAINING_LOCATIONS;
  const [showTraining, setShowTraining] = useState(false);

  const trainingKeys = Object.keys(trainingLabels).filter(k => trainingLabels[k]);

  return (
    <div className="space-y-2.5">
      {/* 研修詳細（折りたたみ） */}
      {trainingKeys.length > 0 && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowTraining(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-black text-white/70 flex items-center gap-2">
              <Info size={14} className="text-indigo-300" /> 研修・イベント詳細
            </span>
            <ChevronRight
              size={16}
              className={`text-white/40 transition-transform ${showTraining ? 'rotate-90' : ''}`}
            />
          </button>
          {showTraining && (
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {trainingKeys.map(key => (
                <div key={key} className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[10px] font-black">{key}</span>
                    <span className="text-xs font-bold text-white/90">{trainingLabels[key]}</span>
                  </div>
                  <div className="text-[10px] text-white/50 leading-snug">{trainingLocations[key] || '詳細なし'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 日別カード */}
      {Array.from({ length: totalDays }).map((_, i) => {
        const day = i + 1;
        const date = new Date(year, month - 1, day);
        const dow = date.getDay(); // 0=日
        const isSun = dow === 0;
        const isSat = dow === 6;
        const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();
        const item = data.schedule[member]?.[i] ?? { type: 'rest' as StatusType, detail: '' };
        const isDone = data.dones[member]?.[day] ?? false;
        const memo = data.memos[member]?.[day] ?? '';

        return (
          <div
            key={day}
            className={`rounded-2xl border p-3 transition-all ${isDone ? 'opacity-50' : ''} ${
              isToday
                ? 'border-indigo-400/60 bg-indigo-500/10 ring-1 ring-indigo-400/30'
                : isSun ? 'border-red-500/20 bg-red-500/5'
                : isSat ? 'border-blue-500/20 bg-blue-500/5'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* 日付ブロック */}
              <div className="flex flex-col items-center justify-center w-11 shrink-0">
                <span className={`text-2xl font-black leading-none tabular-nums ${
                  isSun ? 'text-red-400' : isSat ? 'text-blue-400' : isToday ? 'text-indigo-300' : 'text-white'
                }`}>{day}</span>
                <span className={`text-[10px] font-bold mt-0.5 ${
                  isSun ? 'text-red-400/70' : isSat ? 'text-blue-400/70' : 'text-white/40'
                }`}>{WEEK_JP[dow]}</span>
              </div>

              {/* ステータス選択（大きめタッチターゲット） */}
              <select
                value={item.type}
                onChange={e => onTypeChange(member, i, e.target.value as StatusType)}
                className={`flex-1 h-11 rounded-xl px-3 font-black text-sm border-0 outline-none appearance-none cursor-pointer ${TYPE_CLASS[item.type]}`}
                style={{ fontSize: 16 }}
              >
                {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>

              {/* 完了チェック */}
              <label className="flex flex-col items-center gap-0.5 shrink-0 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={e => onDoneChange(member, day, e.target.checked)}
                  className="accent-indigo-500 w-5 h-5"
                />
                <span className="text-[9px] text-white/40 font-bold">完了</span>
              </label>
            </div>

            {needsDetail(item.type) && (
              <LocalInput
                className="w-full mt-2 h-10 px-3 rounded-xl bg-white/10 text-white/90 border border-white/10 focus:border-indigo-400 outline-none"
                value={item.detail}
                onChange={v => onDetailChange(member, i, v)}
                placeholder="詳細（場所・内容）"
                list="schedule-suggestions"
              />
            )}

            <LocalInput
              className="w-full mt-2 h-10 px-3 rounded-xl bg-white/5 text-white/70 border border-white/10 focus:border-indigo-400 outline-none"
              value={memo}
              onChange={v => onMemoChange(member, day, v)}
              placeholder="メモ"
            />
          </div>
        );
      })}

      <ScheduleSuggestions trainingLabels={data.trainingLabels} />
    </div>
  );
}

// ─── メンバービュー（個人カレンダー） ────────────────────────────────────────

function MemberScheduleView({
  isMobile,
  year, month, member, data,
  onTypeChange, onDetailChange, onMemoChange, onDoneChange,
}: {
  isMobile: boolean;
  year: number; month: number; member: string; data: MonthData;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onMemoChange: (member: string, day: number, val: string) => void;
  onDoneChange: (member: string, day: number, checked: boolean) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const startOffset = getStartOffset(year, month);
  const now = new Date();

  if (isMobile) {
    return (
      <MemberAgendaList
        year={year} month={month} member={member} data={data}
        onTypeChange={onTypeChange}
        onDetailChange={onDetailChange}
        onMemoChange={onMemoChange}
        onDoneChange={onDoneChange}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 研修情報パネル */}
      {Object.keys(data.trainingLabels ?? {}).length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">研修・イベント詳細</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.keys(TRAINING_LABELS).map(key => {
              const label = data.trainingLabels?.[key] ?? TRAINING_LABELS[key] ?? '';
              const loc = data.trainingLocations?.[key] ?? '';
              if (!label) return null;
              return (
                <div key={key} className="bg-white/5 rounded-lg p-2 border border-white/10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 text-[9px] font-black">{key}</span>
                    <span className="text-[11px] font-bold text-white/80 truncate">{label}</span>
                  </div>
                  <div className="text-[9px] text-white/40 leading-tight">{loc || '詳細なし'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* カレンダーグリッド */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="p-3 border-b border-white/10">
          <span className="text-sm font-black text-white">{year}年{month}月 — {member}</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px] p-3">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS_JP.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-black py-1 ${
                  i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-white/40'
                }`}>{d}</div>
              ))}
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`off-${i}`} className="min-h-[90px]" />
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                // startOffset は月曜=0、なので曜日計算:
                const dow = (startOffset + i) % 7; // 0=月, 5=土, 6=日
                const isSat = dow === 5;
                const isSun = dow === 6;
                const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();
                const item = data.schedule[member]?.[i] ?? { type: 'rest' as StatusType, detail: '' };
                const isDone = data.dones[member]?.[day] ?? false;
                const memo = data.memos[member]?.[day] ?? '';

                return (
                  <div
                    key={day}
                    className={`border rounded-lg p-1.5 min-h-[90px] flex flex-col transition-all ${
                      isDone ? 'opacity-40' : ''
                    } ${isToday ? 'border-indigo-400/60 bg-indigo-500/10' : isSun ? 'border-red-500/20 bg-red-500/5' : isSat ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/10 bg-white/3'}`}
                  >
                    <span className={`text-[10px] font-black mb-1 ${
                      isSun ? 'text-red-400' : isSat ? 'text-blue-400' : isToday ? 'text-indigo-300' : 'text-white/60'
                    }`}>{day}</span>

                    <select
                      value={item.type}
                      onChange={e => onTypeChange(member, i, e.target.value as StatusType)}
                      className={`w-full text-[9px] font-black rounded-full px-1 py-0.5 mb-1 border-0 outline-none cursor-pointer ${TYPE_CLASS[item.type]}`}
                      style={{ fontSize: 12 }}
                    >
                      {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                      ))}
                    </select>

                    {(item.type !== 'normal' && item.type !== 'request' && item.type !== 'rest') && (
                      <LocalInput
                        className="w-full text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/80 border border-white/10 focus:border-indigo-400 outline-none mb-1"
                        value={item.detail}
                        onChange={v => onDetailChange(member, i, v)}
                        placeholder="詳細..."
                        list="schedule-suggestions"
                      />
                    )}

                    <LocalTextarea
                      className="w-full text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 focus:border-indigo-400 outline-none resize-none flex-1 min-h-[24px]"
                      value={memo}
                      onChange={v => onMemoChange(member, day, v)}
                      placeholder="メモ..."
                      rows={2}
                    />

                    <label className="flex items-center gap-1 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={e => onDoneChange(member, day, e.target.checked)}
                        className="accent-indigo-500 w-2.5 h-2.5"
                      />
                      <span className="text-[8px] text-white/30">完了</span>
                    </label>
                  </div>
                );

              })}
            </div>

            <datalist id="schedule-suggestions">
              {Object.keys(data.trainingLabels ?? TRAINING_LABELS).map(k => (
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
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 全体ビュー モバイル版（日付ピッカー + 当日メンバー一覧） ───────────────

function OverallDayView({
  year, month, data,
  onTypeChange, onDetailChange, onTeamGoalChange, onOverallMemoChange,
}: {
  year: number; month: number; data: MonthData;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onTeamGoalChange: (val: string) => void;
  onOverallMemoChange: (val: string) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const [selDay, setSelDay] = useState(isCurrentMonth ? now.getDate() : 1);

  // 月が変わって日数が減った場合にクランプ
  useEffect(() => {
    setSelDay(d => Math.min(Math.max(1, d), totalDays));
  }, [totalDays]);

  const di = selDay - 1;
  let activeCount = 0;
  MEMBERS.forEach(name => {
    const it = data.schedule[name]?.[di];
    if (it && isActive(it.type)) activeCount++;
  });

  return (
    <div className="space-y-4">
      {/* チーム目標 */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">今月のチーム目標</div>
        <LocalInput
          className="w-full h-11 px-3 rounded-xl bg-indigo-500/10 border border-indigo-400/20 text-sm text-white/90 font-bold outline-none focus:border-indigo-400"
          value={data.teamGoal}
          onChange={onTeamGoalChange}
          placeholder="今月の全体目標を入力..."
        />
      </div>

      {/* 日付ストリップ */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-slate-950/80 backdrop-blur-sm rounded-xl">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = i + 1;
            const dt = new Date(year, month - 1, d);
            const w = dt.getDay();
            const sel = d === selDay;
            const today = isCurrentMonth && d === now.getDate();
            return (
              <button
                key={d}
                onClick={() => setSelDay(d)}
                className={`flex flex-col items-center justify-center min-w-[46px] h-14 rounded-xl border shrink-0 transition-colors ${
                  sel
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : today ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <span className="text-base font-black tabular-nums leading-none">{d}</span>
                <span className={`text-[9px] font-bold mt-1 ${
                  sel ? 'text-white/80' : w === 0 ? 'text-red-400/80' : w === 6 ? 'text-blue-400/80' : 'text-white/40'
                }`}>{WEEK_JP[w]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日ヘッダー + 稼働人数 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-black text-white">
          {month}月{selDay}日（{WEEK_JP[new Date(year, month - 1, selDay).getDay()]}）
        </span>
        <span className="text-xs font-black text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-full">
          稼働 {activeCount}名
        </span>
      </div>

      {/* 当日のメンバー一覧 */}
      <div className="space-y-2">
        {MEMBERS.map(name => {
          const item = data.schedule[name]?.[di] ?? { type: 'rest' as StatusType, detail: '' };
          return (
            <div key={name} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <span className="flex-1 text-sm font-bold text-white/80 truncate">{name.replace('　', ' ')}</span>
                <select
                  value={item.type}
                  onChange={e => onTypeChange(name, di, e.target.value as StatusType)}
                  className={`h-10 rounded-xl px-3 font-black text-sm border-0 outline-none appearance-none cursor-pointer ${TYPE_CLASS[item.type]}`}
                  style={{ fontSize: 16 }}
                >
                  {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              {needsDetail(item.type) && (
                <LocalInput
                  className="w-full mt-2 h-10 px-3 rounded-xl bg-white/10 text-white/90 border border-white/10 focus:border-indigo-400 outline-none"
                  value={item.detail}
                  onChange={v => onDetailChange(name, di, v)}
                  placeholder="詳細（場所・内容）"
                  list="schedule-suggestions"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 全体メモ */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={13} className="text-white/40" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">全体メモ / 連絡事項</span>
        </div>
        <LocalTextarea
          className="w-full border border-white/10 rounded-xl p-3 text-sm bg-white/5 text-white/70 focus:border-indigo-400 outline-none min-h-[100px] resize-none leading-relaxed"
          value={data.overallMemo ?? ''}
          onChange={onOverallMemoChange}
          placeholder="全体に向けた連絡事項や月間の特記事項を入力してください..."
          rows={4}
        />
      </div>

      <ScheduleSuggestions trainingLabels={data.trainingLabels} />
    </div>
  );
}

// ─── 全体テーブルビュー ───────────────────────────────────────────────────────

function OverallTableView({
  isMobile,
  year, month, data,
  onTypeChange, onDetailChange, onTeamGoalChange, onOverallMemoChange,
}: {
  isMobile: boolean;
  year: number; month: number; data: MonthData;
  onTypeChange: (member: string, dayIdx: number, type: StatusType) => void;
  onDetailChange: (member: string, dayIdx: number, detail: string) => void;
  onTeamGoalChange: (val: string) => void;
  onOverallMemoChange: (val: string) => void;
}) {
  const totalDays = getDaysInMonth(year, month);
  const now = new Date();

  if (isMobile) {
    return (
      <OverallDayView
        year={year} month={month} data={data}
        onTypeChange={onTypeChange}
        onDetailChange={onDetailChange}
        onTeamGoalChange={onTeamGoalChange}
        onOverallMemoChange={onOverallMemoChange}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* チーム目標 */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">今月のチーム目標</div>
        <LocalInput
          className="w-full px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-400/20 text-sm text-white/90 font-bold outline-none focus:border-indigo-400"
          value={data.teamGoal}
          onChange={onTeamGoalChange}
          placeholder="今月の全体目標を入力..."
        />
      </div>

      {/* 全体スケジュールテーブル */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="border-collapse text-[9px]" style={{ tableLayout: 'fixed', minWidth: `${100 + totalDays * 44}px` }}>
            <colgroup>
              <col style={{ width: 100 }} />
              {Array.from({ length: totalDays }).map((_, i) => <col key={i} style={{ width: 44 }} />)}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr style={{ background: 'rgba(15,23,42,0.98)' }}>
                <th className="sticky left-0 z-30 px-2 py-2 text-left border-b border-r border-white/10 text-[9px] font-black text-white/40 uppercase"
                    style={{ background: 'rgba(15,23,42,0.98)' }}>
                  人 / 日
                </th>
                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(year, month - 1, day);
                  const dow = date.getDay();
                  const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();
                  const isSun = dow === 0;
                  const isSat = dow === 6;
                  return (
                    <th key={day} className={`px-0 py-1.5 text-center border-b border-white/10 text-[9px] font-black ${
                      isToday ? 'bg-indigo-600/40' : isSun ? 'bg-red-500/10' : isSat ? 'bg-blue-500/10' : ''
                    }`}>
                      <div className={isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-white/60'}>{day}</div>
                      <div className={`text-[8px] ${isSun ? 'text-red-400/60' : isSat ? 'text-blue-400/60' : 'text-white/25'}`}>
                        {['日','月','火','水','木','金','土'][dow]}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* 稼働人数行 */}
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <td className="sticky left-0 z-10 px-2 py-1 border-r border-white/10 text-[8px] font-black text-white/50"
                    style={{ background: 'rgba(15,23,42,0.95)' }}>
                  稼働人数
                </td>
                {Array.from({ length: totalDays }).map((_, i) => {
                  let count = 0;
                  MEMBERS.forEach(name => {
                    const item = data.schedule[name]?.[i];
                    if (item && item.type !== 'normal' && item.type !== 'request' && item.type !== 'rest') count++;
                  });
                  return (
                    <td key={i} className="px-0 py-1 text-center text-[8px] font-black text-indigo-300 border-b border-white/5">
                      {count > 0 ? count : ''}
                    </td>
                  );
                })}
              </tr>

              {/* メンバー行 */}
              {MEMBERS.map((name, si) => (
                <tr key={name} style={{ background: si % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td className="sticky left-0 z-10 px-2 py-1 border-r border-white/10 text-[9px] font-black text-white/70 truncate"
                      style={{ background: si % 2 === 0 ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.90)' }}>
                    {name.replace('　', ' ')}
                  </td>
                  {Array.from({ length: totalDays }).map((_, di) => {
                    const item = data.schedule[name]?.[di] ?? { type: 'rest' as StatusType, detail: '' };
                    const date = new Date(year, month - 1, di + 1);
                    const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && (di + 1) === now.getDate();
                    const isSun = date.getDay() === 0;
                    const isSat = date.getDay() === 6;
                    return (
                      <td key={di} className={`px-0.5 py-0.5 border-b border-white/5 ${
                        isToday ? 'bg-indigo-600/10' : isSun ? 'bg-red-500/5' : isSat ? 'bg-blue-500/5' : ''
                      }`}>
                        <div className="flex flex-col gap-0.5">
                          <select
                            value={item.type}
                            onChange={e => onTypeChange(name, di, e.target.value as StatusType)}
                            className={`w-full text-[7px] font-black rounded-full px-0.5 py-0.5 border-0 outline-none cursor-pointer ${TYPE_CLASS[item.type]}`}
                            style={{ fontSize: 9 }}
                          >
                            {(Object.keys(TYPE_LABEL) as StatusType[]).map(t => (
                              <option key={t} value={t}>{TYPE_LABEL[t].replace('(〇)', '').replace('(◎)', '')}</option>
                            ))}
                          </select>
                          <LocalInput
                            className="w-full text-[7px] px-0.5 py-0 rounded bg-white/5 text-white/50 border border-white/5 focus:border-indigo-400 outline-none h-3.5"
                            value={item.detail}
                            onChange={v => onDetailChange(name, di, v)}
                            placeholder="..."
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 全体メモ */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={13} className="text-white/40" />
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">全体メモ / 連絡事項</span>
        </div>
        <LocalTextarea
          className="w-full border border-white/10 rounded-xl p-3 text-xs bg-white/5 text-white/70 focus:border-indigo-400 outline-none min-h-[100px] resize-none leading-relaxed"
          value={data.overallMemo ?? ''}
          onChange={onOverallMemoChange}
          placeholder="全体に向けた連絡事項や月間の特記事項を入力してください..."
          rows={4}
        />
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function ScheduleView() {
  const isMobile = useIsMobile();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'member' | 'overall'>('member');
  const [currentMember, setCurrentMember] = useState(MEMBERS[0]);
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // デバウンス中の保留更新を蓄積（連続編集で前の変更を失わないため）
  const pendingRef = useRef<Record<string, unknown>>({});

  const monthKey = `${year}-${month}`;

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const result = await fetchMonthData(y, m);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(year, month); }, [year, month, load]);

  const persistChanges = useCallback((updates: Partial<MonthData> & Record<string, unknown>) => {
    // schedule / memos / dones などのマップは深くマージし、別メンバーへの
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

  const updateData = useCallback((updates: Partial<MonthData>) => {
    setData(prev => prev ? { ...prev, ...updates } : prev);
    persistChanges(updates);
  }, [persistChanges]);

  const handleTypeChange = useCallback((member: string, dayIdx: number, type: StatusType) => {
    setData(prev => {
      if (!prev) return prev;
      const memberSched = [...(prev.schedule[member] ?? [])];
      memberSched[dayIdx] = { ...memberSched[dayIdx], type };
      const newSched = { ...prev.schedule, [member]: memberSched };
      persistChanges({ schedule: { [member]: memberSched } });
      return { ...prev, schedule: newSched };
    });
  }, [persistChanges]);

  const handleDetailChange = useCallback((member: string, dayIdx: number, detail: string) => {
    setData(prev => {
      if (!prev) return prev;
      const memberSched = [...(prev.schedule[member] ?? [])];
      memberSched[dayIdx] = { ...memberSched[dayIdx], detail };
      const newSched = { ...prev.schedule, [member]: memberSched };
      persistChanges({ schedule: { [member]: memberSched } });
      return { ...prev, schedule: newSched };
    });
  }, [persistChanges]);

  const handleMemoChange = useCallback((member: string, day: number, val: string) => {
    setData(prev => {
      if (!prev) return prev;
      const newMemos = { ...prev.memos, [member]: { ...(prev.memos[member] ?? {}), [day]: val } };
      persistChanges({ memos: newMemos });
      return { ...prev, memos: newMemos };
    });
  }, [persistChanges]);

  const handleDoneChange = useCallback((member: string, day: number, checked: boolean) => {
    setData(prev => {
      if (!prev) return prev;
      const newDones = { ...prev.dones, [member]: { ...(prev.dones[member] ?? {}), [day]: checked } };
      persistChanges({ dones: newDones });
      return { ...prev, dones: newDones };
    });
  }, [persistChanges]);

  const handleTeamGoalChange = useCallback((val: string) => {
    updateData({ teamGoal: val });
  }, [updateData]);

  const handleOverallMemoChange = useCallback((val: string) => {
    updateData({ overallMemo: val });
  }, [updateData]);

  const handleBulkImport = useCallback((importedData: Record<string, string[]>) => {
    if (!data) return;
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

    const updates: Partial<MonthData> = { schedule: newSched };
    setData(prev => prev ? { ...prev, ...updates } : prev);
    persistChanges(updates);
  }, [data, year, month, persistChanges]);

  const handleResetMonth = () => {
    if (!window.confirm(`${year}年${month}月のスケジュールを全て空欄にリセットしますか？`)) return;
    const totalDays = getDaysInMonth(year, month);
    const blankSched: MonthData['schedule'] = {};
    for (const member of MEMBERS) {
      blankSched[member] = Array(totalDays).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
    }
    updateData({ schedule: blankSched, trainingLabels: {}, trainingLocations: {} });
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // 月変更時にmemberを維持
  const monthKeyRef = useRef(monthKey);
  useEffect(() => { monthKeyRef.current = monthKey; }, [monthKey]);

  return (
    <div className="flex flex-col h-full min-h-0 text-white">
      {/* ヘッダー */}
      <div className="shrink-0 pb-4 border-b border-white/10">
        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">SCHEDULE</div>
        <div className="flex flex-wrap items-center gap-3">
          {/* 月ナビ */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-base font-black text-white tabular-nums tracking-tight min-w-[6.5rem] text-center">
              {year}年{month}月
            </span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors"
          >
            今月
          </button>

          <button
            onClick={() => load(year, month)}
            className={`w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={14} />
          </button>

          {saving && <span className="text-xs text-indigo-300 font-bold animate-pulse flex items-center gap-1"><Save size={12} />保存中...</span>}

          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <button
              onClick={() => setShowImport(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/20 text-emerald-300 text-xs font-bold transition-colors"
            >
              <Upload size={12} /> 一括インポート
            </button>
            <button
              onClick={handleResetMonth}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/20 text-red-300 text-xs font-bold transition-colors"
            >
              月をリセット
            </button>
          </div>
        </div>

        {/* タブ切替 */}
        <div className="flex gap-1 mt-3 bg-white/5 rounded-xl p-1 w-fit border border-white/10">
          {([
            { id: 'member', label: 'メンバー別' },
            { id: 'overall', label: '全体表示' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-white/40 text-sm font-bold animate-pulse">読み込み中...</div>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/30">
            <span className="text-4xl">📅</span>
            <div className="text-sm font-bold">データを読み込めませんでした</div>
            <button onClick={() => load(year, month)} className="text-xs text-indigo-300 hover:underline">再試行</button>
          </div>
        ) : activeTab === 'member' ? (
          <>
            {/* メンバータブ */}
            <div className="flex overflow-x-auto gap-1.5 pb-3 mb-4 border-b border-white/10 scrollbar-hide">
              {MEMBERS.map(name => (
                <button
                  key={name}
                  onClick={() => setCurrentMember(name)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap font-bold transition-colors border shrink-0 ${
                    name === currentMember
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {name.replace('　', ' ')}
                </button>
              ))}
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(Object.keys(TYPE_LABEL) as StatusType[]).map(type => (
                <span key={type} className={`text-[9px] font-black px-2 py-0.5 rounded-full ${TYPE_CLASS[type]}`}>
                  {TYPE_LABEL[type]}
                </span>
              ))}
            </div>

            <MemberScheduleView
              isMobile={isMobile}
              year={year} month={month} member={currentMember} data={data}
              onTypeChange={handleTypeChange}
              onDetailChange={handleDetailChange}
              onMemoChange={handleMemoChange}
              onDoneChange={handleDoneChange}
            />
          </>
        ) : (
          <OverallTableView
            isMobile={isMobile}
            year={year} month={month} data={data}
            onTypeChange={handleTypeChange}
            onDetailChange={handleDetailChange}
            onTeamGoalChange={handleTeamGoalChange}
            onOverallMemoChange={handleOverallMemoChange}
          />
        )}
      </div>

      {/* 一括インポートモーダル */}
      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onImport={(d) => { handleBulkImport(d); setShowImport(false); }}
        />
      )}
    </div>
  );
}
