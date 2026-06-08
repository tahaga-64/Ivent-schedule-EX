# Push 通知の動作確認チェックリスト

## 事前条件

- `npm run worker:setup` 済み（または手動で Worker デプロイ済み）
- `.env.local` に `VITE_PUSH_WORKER_URL` と `VITE_WEB_PUSH_PUBLIC_KEY` が設定済み
- `npm run build` 後、本番 URL（Firebase Hosting）で確認

## 1. 購読（opt-in）

- [ ] ログインする
- [ ] ヘッダーのベル →「Push通知を有効にする」
- [ ] ブラウザの通知許可ダイアログで「許可」
- [ ] Cloudflare ダッシュボード → KV → `PUSH_SUBSCRIPTIONS` に `sub:` キーが増える

## 2. 配信

- [ ] **編集者アカウント**でイベントを新規作成 → 他端末で OS 通知 + アプリ内通知
- [ ] イベントを更新 → 同上
- [ ] イベントを削除 → 同上
- [ ] 準備物の進捗を更新 → 全購読端末に通知（ログイン済みユーザー）

## 3. iPhone（PWA）

- [ ] Safari で本番 URL → 共有 → ホーム画面に追加
- [ ] ホーム画面のアイコンから起動して Push を有効化
- [ ] 別端末でイベント変更 → iPhone に通知

## 4. ローカル開発

```powershell
# ターミナル1: Worker（要 wrangler login または CLOUDFLARE_API_TOKEN）
npx wrangler dev --config workers/push/wrangler.toml

# .env.local の VITE_PUSH_WORKER_URL を http://127.0.0.1:8787 に一時変更
npm run dev
```

## トラブルシュート

| 症状 | 確認 |
|------|------|
| Push ボタンが出ない | `.env.local` の `VITE_*` がビルドに含まれているか（変更後は再ビルド） |
| 403 on `/send` | イベント作成/更新/削除は `EDITOR_EMAILS` のメールのみ。準備物更新は全ログインユーザー可 |
| CORS エラー | `workers/push/wrangler.toml` の `ALLOWED_ORIGINS` にアクセス元 URL を追加 |
| iPhone で届かない | ホーム画面追加の PWA から開いているか |
