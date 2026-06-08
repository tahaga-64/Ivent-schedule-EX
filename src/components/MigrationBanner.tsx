import { DATA } from '../constants';

interface MigrationBannerProps {
  seeding: boolean;
  seedError: string | null;
  onSeed: () => void;
}

export default function MigrationBanner({ seeding, seedError, onSeed }: MigrationBannerProps) {
  return (
    <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-[12px] text-amber-800 font-bold">
        ⚠️ 初期イベント（{DATA.length}件）がFirestore未移行です。取り込むと全端末で同期・削除が可能になります。
        {seedError && <span className="block text-red-600 font-mono text-[11px] mt-0.5">取込失敗: {seedError}</span>}
      </div>
      <button
        onClick={onSeed}
        disabled={seeding}
        className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs transition-colors disabled:opacity-60"
      >
        {seeding ? '取込中…' : '初期データを取り込む'}
      </button>
    </div>
  );
}
