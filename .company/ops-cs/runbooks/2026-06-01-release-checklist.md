# 🚀 本番リリース実行チェックリスト（2026-06-01）

本日のコード変更を本番反映するための、**オーナー実行手順**。上から順に実施。
（コード側の積み残しは Claude が対応済み・ビルド/型/テスト全通過）

---

## 0. 本日入った変更（要点）
- 写真削除API `deletePhoto` に **Firebase IDトークン認証**を追加（未ログインの不正削除を防止）
- 静的DATA→Firestore **移行の仕組み**（アプリ内「初期データ取込」ボタン＋移行フラグ）
- 準備物リストの **自動保存**（「チェックしたのに消えた」を解消）
- **PWAホーム画面追加**対応（manifest＋メタタグ）
- アクセス拒否画面に**問い合わせ先**を追加
- デッドコード削除（Supabase残骸スクリプト）
- `firebase-admin` を dependencies へ移動

---

## 1. 🔑 Vercel 環境変数（Production）
- [ ] **`FIREBASE_SERVICE_ACCOUNT_JSON`** ← **今回から必須**。未設定だと写真削除APIが 503 で動きません
      （Firebase Console → プロジェクト設定 → サービスアカウント → 新しい秘密鍵を生成 → JSON全文を貼付）
- [ ] `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- [ ] `VITE_FIREBASE_*` 一式（既存のまま）
- [ ] ~~`VITE_FIREBASE_VAPID_KEY`~~ → **不要**（プッシュ通知は未実装のため）

## 2. 🔥 Firebase Console
- [ ] `allowedUsers` コレクションに4名を登録（未登録分があれば追加）
      `taoki0183@gmail.com` / `haruhito3901@gmail.com` / `m.takada.kp@gmail.com` / `momansahaton@icloud.com`
- [ ] Authentication → 承認済みドメイン に**本番ドメイン**を追加（未登録だとGoogleログインが `auth/unauthorized-domain` エラー）

## 3. 📜 Firestore セキュリティルールをデプロイ
- [ ] `firestore.rules` をデプロイ（**今回 `appConfig` ルールを追加済み** — 移行フラグの読み書きに必要）

## 4. 🚢 コードをデプロイ
- [ ] main にマージ → Vercel 自動デプロイ → デプロイが **Ready** になることを確認

## 5. 🌱 初期データを取り込む（デプロイ後・1回だけ）
- [ ] **PC** で編集者アカウントでログイン
- [ ] 画面上部の黄色バナー「**初期データを取り込む**」をクリック（25件をFirestoreへ。既存は上書きしません）
      ※ CLI派なら代替: `FIREBASE_SERVICE_ACCOUNT_JSON` を設定して `npx tsx scripts/migrate-events.ts`
- [ ] 取込後、バナーが消え、全イベントが表示されることを確認（以降はFirestore優先＝削除も反映）

## 6. ✅ 本番動作確認
- [ ] 許可ユーザーでログイン成功／非許可ユーザーはアクセス拒否画面＋問い合わせリンク表示
- [ ] イベント一覧・カレンダーが表示される
- [ ] 準備物リスト：チェックすると「✓ 自動保存済み」表示 → 別端末でも反映
- [ ] 写真：アップロード＆削除が成功（削除は要 `FIREBASE_SERVICE_ACCOUNT_JSON`）
- [ ] スマホ（iOS Safari / Android Chrome）で「ホーム画面に追加」→ 全画面起動できる

## 7. 📣 スタッフへ周知
- [ ] `staff-user-guide.md`（スタッフ向け利用ガイド）を配布（印刷 or PDF or チャット共有）
- [ ] アプリURLと「ホーム画面に追加」の案内を添える

---

## リリース後に対応（今回は安全のため見送り）
- 種別マスターの Firestore 化（現状 localStorage・端末ごと）
- Cloudinary 署名アップロード（現状 unsigned）
- App.tsx 分割／iCalエクスポート等
- プッシュ通知（FCM）の実装可否を判断（運用手順書の通知記述は実装後に整合させる）
