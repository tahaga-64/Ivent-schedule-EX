import { Images } from 'lucide-react';

export default function AlbumView() {
  return (
    <div className="relative z-10 flex flex-col min-h-full bg-[var(--bg-app)]">
      <div className="sticky top-0 z-10 flex items-center px-4 py-4 border-b border-slate-200 bg-white">
        <div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHOTOS</div>
          <h2 className="text-2xl font-black text-slate-900">アルバム</h2>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-4 text-slate-400 min-h-[60vh]">
        <Images size={48} className="opacity-30" />
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-slate-500">写真はイベント詳細モーダルの</p>
          <p className="text-sm font-bold text-slate-500">フォトギャラリーからご覧ください</p>
        </div>
        <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
          イベントを選択して詳細を開き、「写真」タブから閲覧・アップロードができます
        </p>
      </div>
    </div>
  );
}
