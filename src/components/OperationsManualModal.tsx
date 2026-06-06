import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className="flex-1 font-black text-sm text-slate-800">{title}</span>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 bg-slate-50/60 text-sm text-slate-700 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
      <span className="shrink-0">⚠️</span>
      <span>{text}</span>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 text-xs text-indigo-800">
      <span className="shrink-0">💡</span>
      <span>{text}</span>
    </div>
  );
}

export default function OperationsManualModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">OPERATIONS</div>
                <h2 className="text-lg font-black text-slate-900">編集スタッフ 運用手順書</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-6 py-5 space-y-3">

              {/* 権限 */}
              <Accordion title="権限について（誰が何をできるか）">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'イベント作成・編集・削除', who: '編集スタッフ（PC のみ）' },
                    { label: '準備物リスト 編集', who: 'ログイン済み全員' },
                    { label: '写真アップロード', who: 'ログイン済み全員' },
                    { label: '魚リスト 編集', who: 'ログイン済み全員' },
                    { label: 'レイアウト 編集', who: 'ログイン済み全員' },
                    { label: '備品マスター 編集', who: 'ログイン済み全員' },
                  ].map(row => (
                    <div key={row.label} className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="font-bold text-slate-800 mb-1">{row.label}</div>
                      <div className="text-slate-500">{row.who}</div>
                    </div>
                  ))}
                </div>
                <Note text="イベント編集は PC のみ有効です。スマホからは閲覧・準備物の更新のみ可能です。" />
              </Accordion>

              {/* イベント作成 */}
              <Accordion title="イベントを新規作成する">
                <Step n={1} text="画面右上の「＋ 新規イベント」ボタンをクリック" />
                <Step n={2} text="モーダルが開くので「会場名」「開始日」「種別」「地域」を入力（必須項目）" />
                <Step n={3} text="担当スタッフ・クライアント名・備考などを入力（任意）" />
                <Step n={4} text="「保存」ボタンをクリックして Firestore に保存" />
                <Tip text="「キャンセル」を押すと保存せずに閉じます。保存前にモーダルを閉じた場合も自動的に破棄されます。" />
              </Accordion>

              {/* イベント編集 */}
              <Accordion title="イベントを編集する">
                <Step n={1} text="ホーム・カレンダー・カンバンのいずれかからイベントカードをクリック" />
                <Step n={2} text="詳細モーダルが開く。「詳細」タブで各項目を編集" />
                <Step n={3} text="編集後「保存」ボタンをクリック（保存前は * マークが表示される）" />
                <Note text="画面を閉じる前に必ず保存してください。未保存の変更がある場合は確認ダイアログが表示されます。" />
              </Accordion>

              {/* ステータス変更 */}
              <Accordion title="ステータスを変更する">
                <div className="space-y-1.5">
                  {[
                    { s: '予定', c: 'bg-slate-100 text-slate-600', desc: 'イベントが登録された初期状態' },
                    { s: '準備中', c: 'bg-amber-100 text-amber-700', desc: '備品や手配を進めている状態' },
                    { s: '入荷待ち', c: 'bg-blue-100 text-blue-700', desc: '発注済みで到着待ちの状態' },
                    { s: '準備完了', c: 'bg-blue-500 text-white', desc: 'すべての準備が整った状態' },
                    { s: '完了', c: 'bg-slate-800 text-white', desc: 'イベントが終了した状態（アーカイブへ）' },
                    { s: 'キャンセル', c: 'bg-red-100 text-red-600', desc: '中止になったイベント' },
                  ].map(row => (
                    <div key={row.s} className="flex items-center gap-3">
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-black ${row.c}`}>{row.s}</span>
                      <span className="text-xs text-slate-600">{row.desc}</span>
                    </div>
                  ))}
                </div>
                <Tip text="カンバンビューでは列間をドラッグ＆ドロップでステータス変更できます（PC のみ）。" />
              </Accordion>

              {/* 準備物リスト */}
              <Accordion title="準備物リストを使う">
                <Step n={1} text="ナビゲーションの「準備物」をクリック → イベントを選択" />
                <Step n={2} text="「＋ 備品を追加」でアイテムを追加。備品マスターから選択するか手動入力" />
                <Step n={3} text="持参済みのアイテムはチェックボックスをクリックして完了マーク" />
                <Step n={4} text="「印刷」ボタンで準備リストを印刷（A4対応）" />
                <Tip text="「商談提案用」ボタンを押すと、クライアントに見せるための提案フォーマットで印刷できます。" />
                <Tip text="「LINE共有」ボタンで準備リストのテキストをLINEで送信できます。" />
              </Accordion>

              {/* 写真 */}
              <Accordion title="写真をアップロードする">
                <Step n={1} text="イベント詳細モーダルを開き「写真」タブを選択" />
                <Step n={2} text="「写真を追加」ボタンまたは画像をドラッグ＆ドロップでアップロード" />
                <Step n={3} text="アップロード後、キャプションを入力可能" />
                <Note text="ファイルサイズは 10MB 以下を推奨。Cloudinary に保存されます。" />
              </Accordion>

              {/* 魚リスト */}
              <Accordion title="魚リストを管理する">
                <Step n={1} text="下部ナビの「魚リスト」をクリックしてイベントを選択" />
                <Step n={2} text="「＋ 魚を追加」で種類・数・金額・メモを入力" />
                <Step n={3} text="リスト下部に合計金額が自動表示される" />
                <Tip text="仕入れ状況のメモ欄は長文でもスクロール表示されます。" />
              </Accordion>

              {/* レイアウト */}
              <Accordion title="フロアレイアウトを作成する">
                <Step n={1} text="ナビの「レイアウト」でイベントを選択" />
                <Step n={2} text="左パレットからアイテム（テーブル・タッチパネル・入口など）を選んでキャンバスに配置" />
                <Step n={3} text="配置後、アイテムをドラッグで移動・コーナーをドラッグでリサイズ" />
                <Step n={4} text="「保存」ボタンで Firestore に保存" />
                <Tip text="横向き（ランドスケープ）モードでより広いキャンバスで作業できます。" />
              </Accordion>

              {/* 備品マスター */}
              <Accordion title="備品マスターを管理する">
                <Step n={1} text="ナビの「備品」をクリック" />
                <Step n={2} text="「追加」ボタンから品名・単価・デフォルト数量・メモ・購入URLを登録" />
                <Step n={3} text="登録済みアイテムは準備物リストで選択候補として使えるようになる" />
                <Tip text="購入URLを登録しておくと、準備物リストから直接商品ページを開けます。" />
              </Accordion>

              {/* トラブル */}
              <Accordion title="よくあるトラブル">
                <div className="space-y-3">
                  <div>
                    <div className="font-bold text-slate-700 mb-1">保存ボタンを押しても反応しない</div>
                    <div className="text-xs text-slate-600">必須項目（会場名・開始日・種別・地域）が未入力の可能性があります。赤くハイライトされている項目を確認してください。</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 mb-1">写真がアップロードされない</div>
                    <div className="text-xs text-slate-600">ファイルサイズが大きすぎるか、ネットワークが不安定な可能性があります。10MB 以下の JPEG/PNG をお試しください。</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 mb-1">イベント編集ボタンがグレーアウトしている</div>
                    <div className="text-xs text-slate-600">編集権限のあるアカウントでログインしているか、PC（デスクトップ画面）で操作しているか確認してください。</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 mb-1">データが表示されない・古いデータが出る</div>
                    <div className="text-xs text-slate-600">ページをリロード（Cmd+R / Ctrl+R）してください。Firestore からリアルタイムで同期されます。</div>
                  </div>
                </div>
              </Accordion>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-between">
              <div className="text-xs text-slate-400">EX事業部 イベント管理システム — 編集スタッフ向け</div>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-black hover:bg-slate-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
