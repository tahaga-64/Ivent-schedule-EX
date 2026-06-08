import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { NewEventDraft } from '../types/index';
import { REGIONS } from '../constants';

interface Props {
  onClose: () => void;
  onSubmit: (draft: NewEventDraft) => void;
  sidebarTypes: { label: string; icon: string }[];
}

export default function NewEventModal({ onClose, onSubmit, sidebarTypes }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [draft, setDraft] = useState<NewEventDraft>({
    venue: '', client: '', type: sidebarTypes[0]?.label ?? '', region: REGIONS[0], start: today, end: today,
  });

  const set = <K extends keyof NewEventDraft>(k: K, v: NewEventDraft[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.venue.trim()) return;
    onSubmit(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-md w-full max-w-md md:max-w-xl lg:max-w-2xl p-6 z-10">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">新規イベント作成</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-150 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              会場 *
            </label>
            <input
              type="text" value={draft.venue} required
              onChange={e => set('venue', e.target.value)}
              placeholder="会場名を入力..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              クライアント
            </label>
            <input
              type="text" value={draft.client}
              onChange={e => set('client', e.target.value)}
              placeholder="クライアント名を入力..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">種別</label>
            <div className="flex flex-wrap gap-1.5">
              {sidebarTypes.map(t => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => set('type', t.label)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                    draft.type === t.label
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{t.icon}</span><span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">地域</label>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('region', r)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                    draft.region === r
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">開始日</label>
              <input type="date" value={draft.start} onChange={e => set('start', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">終了日</label>
              <input type="date" value={draft.end} min={draft.start} onChange={e => set('end', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all duration-150">
              キャンセル
            </button>
            <button type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-all duration-150">
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
