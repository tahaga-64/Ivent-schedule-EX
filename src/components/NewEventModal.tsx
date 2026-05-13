import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { EventType, Region, NewEventDraft } from '../types/index';
import { EVENT_TYPES } from '../data/eventTypes';

interface Props {
  onClose: () => void;
  onSubmit: (draft: NewEventDraft) => void;
}

const REGIONS: Region[] = ['東日本', '西日本', '南日本', '中日本'];

export default function NewEventModal({ onClose, onSubmit }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [draft, setDraft] = useState<NewEventDraft>({
    venue: '', client: '', type: 'DJI', region: '東日本', start: today, end: today,
    carrierInflow: {},
    retrospective: {},
  });

  const set = <K extends keyof NewEventDraft>(k: K, v: NewEventDraft[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));
  const setCarrier = (k: 'docomo' | 'au' | 'softbank' | 'rakuten' | 'other', v: number) =>
    setDraft(prev => ({ ...prev, carrierInflow: { ...(prev.carrierInflow || {}), [k]: v } }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.venue.trim()) return;
    onSubmit(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-md w-full max-w-md p-6 z-10">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">?????????</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-150 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              ??? *
            </label>
            <input
              type="text" value={draft.venue} required
              onChange={e => set('venue', e.target.value)}
              placeholder="??????..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              ??????
            </label>
            <input
              type="text" value={draft.client}
              onChange={e => set('client', e.target.value)}
              placeholder="??????????..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">??</label>
              <select value={draft.type} onChange={e => set('type', e.target.value as EventType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all">
                {EVENT_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">??</label>
              <select value={draft.region} onChange={e => set('region', e.target.value as Region)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all">
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">???</label>
              <input type="date" value={draft.start} onChange={e => set('start', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">???</label>
              <input type="date" value={draft.end} min={draft.start} onChange={e => set('end', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
            </div>
          </div>

          <details className="border border-gray-200 rounded-xl p-3 bg-gray-50/70">
            <summary className="cursor-pointer text-xs font-bold text-gray-700">📊 イベント実績（開催後に入力）</summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  value={draft.sales ?? ''}
                  onChange={e => set('sales', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="売上（円）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={draft.grossProfit ?? ''}
                  onChange={e => set('grossProfit', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="粗利（円）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" min={0} value={draft.attendance ?? ''} onChange={e => set('attendance', e.target.value ? Number(e.target.value) : undefined)} placeholder="来場数" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" min={0} value={draft.seatedCount ?? ''} onChange={e => set('seatedCount', e.target.value ? Number(e.target.value) : undefined)} placeholder="着座数" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" min={0} value={draft.contracts ?? ''} onChange={e => set('contracts', e.target.value ? Number(e.target.value) : undefined)} placeholder="成約数" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min={0} value={draft.carrierInflow?.docomo ?? ''} onChange={e => setCarrier('docomo', Number(e.target.value) || 0)} placeholder="docomo" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" min={0} value={draft.carrierInflow?.au ?? ''} onChange={e => setCarrier('au', Number(e.target.value) || 0)} placeholder="au" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" min={0} value={draft.carrierInflow?.softbank ?? ''} onChange={e => setCarrier('softbank', Number(e.target.value) || 0)} placeholder="SoftBank" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" min={0} value={draft.carrierInflow?.rakuten ?? ''} onChange={e => setCarrier('rakuten', Number(e.target.value) || 0)} placeholder="楽天" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" min={0} value={draft.carrierInflow?.other ?? ''} onChange={e => setCarrier('other', Number(e.target.value) || 0)} placeholder="その他" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm col-span-2" />
              </div>
              <textarea
                value={draft.retrospective?.goodPoints ?? ''}
                onChange={e => set('retrospective', { ...(draft.retrospective || {}), goodPoints: e.target.value })}
                placeholder="良かった点"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[70px]"
              />
              <textarea
                value={draft.retrospective?.improvements ?? ''}
                onChange={e => set('retrospective', { ...(draft.retrospective || {}), improvements: e.target.value })}
                placeholder="改善点"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[70px]"
              />
            </div>
          </details>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all duration-150">
              ?????
            </button>
            <button type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-all duration-150">
              ????
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
