import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

const SUPPORT_EMAIL = 'taoki0183@gmail.com';

/** アプリ内の「使い方ガイド」モーダル。スタッフがアプリから直接読める（リポジトリ権限不要）。 */
export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center lg:p-4">
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
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative z-10 w-full lg:w-[640px] lg:max-w-[92vw] max-h-[90vh] lg:max-h-[88vh] bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">HELP</div>
                <h2 className="text-base font-black text-slate-900">使い方ガイド</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-5 py-5 space-y-7 text-sm text-slate-700 leading-relaxed">
              <Section title="1. ログイン">
                <p>ブラウザ（スマホは Safari か Chrome）でアプリのURLを開き、<b>Google / Apple / メール</b>のいずれかでログインします。</p>
                <Callout>「アクセス権限がありません」と出たら未登録です。開発者に聞くか、画面の「管理者に連絡する」から、ログインに使ったメールを添えて連絡してください。青木が直接答えます</Callout>
              </Section>

              <Section title="2. ホーム画面に追加">
                <p className="font-bold text-slate-800">iPhone（Safari）</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>共有ボタン（□から↑）をタップ</li>
                  <li>「ホーム画面に追加」→OK</li>
                </ol>
                <p className="font-bold text-slate-800 mt-2">Android（Chrome）</p>
                <ol className="list-decimal pl-5 space-y-0.5">
                  <li>右上「︙」→「ホーム画面に追加 / アプリをインストール」</li>
                </ol>
              </Section>

              <Section title="3. 画面の使い方">
                <InfoTable rows={[
                  ['ホーム', '直近・開催中・期限が近いイベントを確認'],
                  ['カレンダー', '月/日でイベント一覧。会場・クライアントで検索可'],
                  ['準備物リスト', 'イベントごとの持ち物・備品をチェック管理'],
                  ['アーカイブ', '終了イベントの記録'],
                  ['備品マスター', 'よく使う備品のひな型'],
                  ['魚リスト / レイアウト', '水族館イベントの魚・会場レイアウト'],
                ]} />
              </Section>

              <Section title="4. 準備物リスト">
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>「新しい項目を追加」で品名・数量・単価などを入力（金額は自動計算されます）</li>
                  <li>発注状況（未発注→発注済→配送中→着荷）と追跡番号で進捗管理</li>
                  <li>印刷・Excel出力が可能</li>
                </ul>
                <Callout tone="emerald">自動保存です（「保存」ボタン不要）。上部の「✓ 自動保存済み」を確認すればOK。</Callout>
              </Section>

              <Section title="5. 写真">
                <p>イベント詳細の「写真」タブからアップロードします。Cloudinary でアプリ内表示し、選択した Google Drive フォルダにも同期します（最大5枚・1枚10MB）。</p>
              </Section>

              <Section title="6. レイアウト">
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>左のパレットから什器をタップで配置、ドラッグで移動、選択で回転・サイズ変更</li>
                  <li>「＋カスタム」で独自アイテム（名前・色）を追加</li>
                  <li>「写真」で参考写真を添付、「URL共有」でクライアントに共有できます</li>
                  <li>スマホは横向きにすると編集エリアが広がります</li>
                </ul>
              </Section>

              <Section title="7. 編集できる人">
                <InfoTable rows={[
                  ['イベントの閲覧・検索', 'ログインした全員'],
                  ['準備物・写真・魚・レイアウト編集', 'ログインした全員（スマホも可）'],
                  ['イベント本体の作成/編集/削除', '一部の編集担当者・PCのみ'],
                ]} />
                <Callout>スマホでイベント本体を編集できないのは仕様（誤操作防止）。準備物・写真はスマホでも編集できます。</Callout>
              </Section>

              <Section title="8. 想定される質問について">
                <InfoTable rows={[
                  ['ログインで弾かれる', '未登録です。管理者にメール登録を依頼'],
                  ['準備物のチェックは保存される？', '自動保存。「✓ 自動保存済み」を確認'],
                  ['写真が上がらない', '10MB以下・画像形式か確認'],
                  ['表示名を変えたい', 'Googleの表示名を変更し再ログイン'],
                ]} />
              </Section>

              <Section title="9. 困ったときは">
                <p>解決しないときは、画面のスクリーンショットを添えて連絡してください。</p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=イベント管理アプリ お問い合わせ`}
                  className="inline-block mt-1 font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                >
                  管理者（{SUPPORT_EMAIL}）に連絡
                </a>
              </Section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function Callout({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'emerald' }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-slate-50 border-slate-200 text-slate-600';
  return <div className={`text-xs rounded-xl border px-3 py-2 ${cls}`}>{children}</div>;
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[42%_58%]">
          <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700">{k}</div>
          <div className="px-3 py-2 text-xs text-slate-600">{v}</div>
        </div>
      ))}
    </div>
  );
}
