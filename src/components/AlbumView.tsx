import { Images, ExternalLink } from 'lucide-react';
import { GOOGLE_DRIVE_FOLDER_URL } from '../lib/photoStorage';

export default function AlbumView() {
  return (
    <div className="relative z-10 flex flex-col min-h-full bg-[var(--bg-app)]">
      <div className="sticky top-0 z-10 flex items-center px-4 py-4 border-b border-slate-200 bg-white">
        <div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHOTOS</div>
          <h2 className="text-2xl font-black text-slate-900">アルバム</h2>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 min-h-[60vh]">
        <Images size={48} className="text-slate-300" />

        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-slate-500">写真はイベント詳細モーダルの</p>
          <p className="text-sm font-bold text-slate-500">フォトギャラリーからご覧ください</p>
        </div>
        <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
          イベントを選択して詳細を開き、「写真」タブから閲覧・アップロードができます
        </p>

        {/* Google Drive リンク */}
        <div className="mt-2 w-full max-w-sm">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">ストレージ</div>
          <a
            href={GOOGLE_DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 hover:bg-slate-50 hover:border-indigo-200 active:scale-[0.98] transition-all shadow-sm group"
          >
            <div>
              <div className="font-black text-sm text-slate-900 leading-tight">Google Drive</div>
              <div className="text-xs text-slate-500 mt-0.5">写真バックアップフォルダを開く</div>
            </div>
            <ExternalLink size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0 ml-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
