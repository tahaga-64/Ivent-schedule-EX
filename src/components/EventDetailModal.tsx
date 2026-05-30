import { X, Save, Trash2, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { Event, EventStatus, EventPhoto, type FieldAuthorAttribution } from '../types';
import { REGIONS } from '../constants';
import { rs, ts, statusStyle, getDaysInRange, formatDayLabel, type ValidationError } from '../lib/eventHelpers';
import { type StaffMember } from '../types';
import PhotoUpload from './photos/PhotoUpload';
import PhotoGallery from './photos/PhotoGallery';
import { MAX_PHOTOS } from '../lib/photoStorage';

// ── フィールド帰属 ─────────────────────────────────────────────────────────

function buildFieldAttribution(user: User | null): FieldAuthorAttribution | undefined {
  if (!user) return undefined;
  return {
    updatedByUid: user.uid,
    updatedByEmail: user.email ?? null,
    updatedByName: user.displayName ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function formatAttributionLine(meta: FieldAuthorAttribution | undefined): string | null {
  if (!meta?.updatedAt) return null;
  const date = new Date(meta.updatedAt);
  const dateStr = Number.isNaN(date.getTime())
    ? meta.updatedAt
    : date.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
  const name = meta.updatedByName?.trim();
  const email = meta.updatedByEmail?.trim();
  if (name && email) return `最終記入: ${name}（${email}）・${dateStr}`;
  if (email) return `最終記入: ${email}・${dateStr}`;
  if (name) return `最終記入: ${name}・${dateStr}`;
  if (meta.updatedByUid) return `最終記入: UID ${meta.updatedByUid.slice(0, 8)}…・${dateStr}`;
  return `最終記入: ${dateStr}`;
}

// ── 型 ────────────────────────────────────────────────────────────────────

type ModalTab = 'detail' | 'photos';

export interface EventDetailModalProps {
  selected: Event;
  onClose: () => void;
  canEditEvent: boolean;
  canUploadPhoto: boolean;
  sidebarTypes: { label: string; icon: string }[];
  staffList: StaffMember[];
  user: User | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: ValidationError[];
  eventStats: { itemCount: number; preparedCount: number; budget: number };
  localDailyRoles: Record<string, Record<string, string>>;
  setLocalDailyRoles: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  modalTab: ModalTab;
  setModalTab: React.Dispatch<React.SetStateAction<ModalTab>>;
  onUpdate: (id: string, updates: Partial<Event>) => void;
  onSave: () => Promise<boolean>;
  onDelete: () => void;
  onOpenPrepList: () => void;
  photoUploading: boolean;
  uploadProgress: number;
  photoError: string | null;
  onUploadPhoto: (file: File) => Promise<EventPhoto | null | undefined>;
  onDeletePhoto: (photo: EventPhoto) => Promise<void>;
  onUpdatePhotoCaption: (photo: EventPhoto, caption: string) => Promise<void>;
}

// ── コンポーネント ─────────────────────────────────────────────────────────

export default function EventDetailModal({
  selected,
  onClose,
  canEditEvent,
  canUploadPhoto,
  sidebarTypes,
  staffList,
  user,
  isSaving,
  hasUnsavedChanges,
  validationErrors,
  eventStats,
  localDailyRoles,
  setLocalDailyRoles,
  modalTab,
  setModalTab,
  onUpdate,
  onSave,
  onDelete,
  onOpenPrepList,
  photoUploading,
  uploadProgress,
  photoError,
  onUploadPhoto,
  onDeletePhoto,
  onUpdatePhotoCaption,
}: EventDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col border border-gray-100 w-full lg:w-[520px] lg:max-w-[520px] max-h-[92vh] lg:max-h-[90vh]"
      >
        {selected.status === 'completed' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-orange-500 border-b border-orange-600">
            <span className="text-white">⚑</span>
            <span className="text-xs font-bold text-white">このイベントは終了しました</span>
          </div>
        )}
        <div className="p-6 lg:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto overflow-x-hidden">
          {/* Header: タグ + 閉じるボタン */}
          <div className="flex justify-between items-center mb-5">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    disabled={!canEditEvent}
                    onClick={() => canEditEvent && onUpdate(selected.id, { region: r, dept: '' })}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                      selected.region === r
                        ? 'text-white border-transparent'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    } ${!canEditEvent ? 'cursor-default' : 'cursor-pointer'}`}
                    style={selected.region === r
                      ? { background: rs(r).dot, borderColor: rs(r).dot }
                      : {}
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sidebarTypes.map(t => (
                  <button
                    key={t.label}
                    type="button"
                    disabled={!canEditEvent}
                    onClick={() => canEditEvent && onUpdate(selected.id, { type: t.label })}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                      selected.type === t.label
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    } ${!canEditEvent ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <span>{t.icon}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="h-px bg-gray-100 mb-4"></div>

          {/* タブ切替 */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
            {(
              [
                { id: 'detail', label: '詳細' },
                { id: 'photos', label: `写真${selected.photos?.length ? ` (${selected.photos.length})` : ''}` },
              ] as { id: ModalTab; label: string }[]
            ).map(t => (
              <button
                key={t.id}
                onClick={() => setModalTab(t.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${modalTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 写真タブ */}
          {modalTab === 'photos' && (
            <div className="space-y-4">
              {canUploadPhoto && (selected.photos?.length ?? 0) < MAX_PHOTOS && (
                <PhotoUpload
                  onUpload={async (file) => {
                    const newPhoto = await onUploadPhoto(file);
                    // hasUnsavedChanges=true のとき onSnapshot が selected を更新しないため手動反映は呼び出し元で行う
                    void newPhoto;
                  }}
                  uploading={photoUploading}
                  uploadProgress={photoUploading ? uploadProgress : 0}
                  currentCount={selected.photos?.length ?? 0}
                  maxPhotos={MAX_PHOTOS}
                />
              )}
              {canUploadPhoto && (selected.photos?.length ?? 0) >= MAX_PHOTOS && (
                <p className="text-xs text-center text-slate-400 py-2">写真は最大{MAX_PHOTOS}枚までです</p>
              )}
              {photoError && <p className="text-xs text-red-500 font-bold">{photoError}</p>}
              <PhotoGallery
                photos={selected.photos || []}
                onDelete={async (photo) => {
                  await onDeletePhoto(photo);
                }}
                onUpdateCaption={async (photo, caption) => {
                  await onUpdatePhotoCaption(photo, caption);
                }}
                canEdit={canUploadPhoto}
              />
            </div>
          )}

          {/* フィールド */}
          {modalTab === 'detail' && <><div className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">VENUE・会場</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                value={selected.venue}
                placeholder="会場を入力..."
                disabled={!canEditEvent}
                onChange={e => onUpdate(selected.id, { venue: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">START</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  value={selected.start}
                  disabled={!canEditEvent}
                  onChange={e => onUpdate(selected.id, { start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">END</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                  value={selected.end}
                  disabled={!canEditEvent}
                  onChange={e => onUpdate(selected.id, { end: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">CLIENT・クライアント</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
                value={selected.client}
                placeholder="クライアント名を入力..."
                disabled={!canEditEvent}
                onChange={e => onUpdate(selected.id, { client: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">メモ</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[88px] resize-none read-only:bg-gray-50 read-only:text-gray-500"
                value={selected.detailMemo ?? ''}
                placeholder="例：搬入は西口ローリング床／15:00までに主電源・Wi-Fi確認"
                readOnly={!canEditEvent}
                onChange={e => {
                  const detailMemo = e.target.value;
                  onUpdate(selected.id, {
                    detailMemo,
                    detailMemoAttribution: buildFieldAttribution(user) ?? selected.detailMemoAttribution,
                  });
                }}
              />
              {formatAttributionLine(selected.detailMemoAttribution) ? (
                <p className="mt-1.5 text-[11px] text-gray-500">{formatAttributionLine(selected.detailMemoAttribution)}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">担当者</label>
              {staffList.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">サイドバーのスタッフ欄からメンバーを追加してください。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {staffList.map(staff => {
                    const isAssigned = (selected.assignees ?? []).includes(staff.name);
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        disabled={!canEditEvent}
                        onClick={() => {
                          const current = selected.assignees ?? [];
                          const next = isAssigned
                            ? current.filter(n => n !== staff.name)
                            : [...current, staff.name];
                          onUpdate(selected.id, { assignees: next });
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                          isAssigned
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {staff.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 日別役割 */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">日別役割</label>
              {(selected.assignees ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 py-2">担当者を選択すると日別に役割を設定できます。</p>
              ) : (
                <div className="space-y-3">
                  {getDaysInRange(selected.start, selected.end).map(date => (
                    <div key={date} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      <div className="text-[11px] font-bold text-gray-500 mb-2">{formatDayLabel(date)}</div>
                      <div className="space-y-2">
                        {(selected.assignees ?? []).map(memberName => (
                          <div key={memberName} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700 w-20 shrink-0 truncate">{memberName}</span>
                            <input
                              type="text"
                              value={localDailyRoles?.[date]?.[memberName] ?? ''}
                              disabled={!canEditEvent}
                              placeholder="役割を入力"
                              onChange={e => {
                                const val = e.target.value;
                                setLocalDailyRoles(prev => ({
                                  ...prev,
                                  [date]: { ...(prev[date] ?? {}), [memberName]: val },
                                }));
                              }}
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ステータス */}
            {canEditEvent && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ステータス</label>
                <div className="flex flex-wrap gap-2">
                  {(['scheduled','in_progress','waiting','ready','completed','cancelled'] as const).map(s => {
                    const sty = statusStyle(s);
                    const isActive = (selected?.status ?? 'scheduled') === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onUpdate(selected.id, { status: s })}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                          isActive
                            ? `${sty.bg} ${sty.text} border-current`
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: sty.dot }} />}
                        {sty.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 統計パネル */}
          <div className="mt-6 bg-gray-50 rounded-2xl p-5 grid grid-cols-3 divide-x divide-gray-200">
            <div className="pr-5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ITEMS</div>
              <div className="text-2xl font-black text-gray-800">{eventStats.itemCount}</div>
            </div>
            <div className="px-5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PREPARED</div>
              <div className="text-2xl font-black text-indigo-600">
                {eventStats.preparedCount}/{eventStats.itemCount}
              </div>
            </div>
            <div className="pl-5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">BUDGET</div>
              <div className="text-2xl font-black text-gray-800">¥{eventStats.budget.toLocaleString()}</div>
            </div>
          </div>

          {/* ボタン */}
          <div className="mt-6 flex gap-3">
            {hasUnsavedChanges && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex-1 py-4 rounded-2xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-lg shadow-amber-500/20"
              >
                <Save size={16} />
                {isSaving ? "保存中..." : "保存する"}
              </button>
            )}
            <button
              onClick={onOpenPrepList}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <ClipboardList size={18} />
              準備物リストを開く
            </button>
          </div>
          {canEditEvent && (
            <button
              onClick={onDelete}
              className="w-full mt-2 py-3 rounded-2xl border border-red-200 text-sm font-bold text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              このイベントを削除
            </button>
          )}

          <AnimatePresence>
            {validationErrors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl"
              >
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 font-bold">
                    ⚠️ {err.message}
                  </p>
                ))}
              </motion.div>
            )}
            {hasUnsavedChanges && validationErrors.length === 0 && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="text-[10px] text-center text-amber-500 mt-4 font-bold tracking-widest"
              >
                ⚠️ 未保存の変更があります
              </motion.p>
            )}
          </AnimatePresence>
          </>}
        </div>
      </motion.div>
    </div>
  );
}
