# 無料 Web Push セットアップ

Firebase Auth / Firestore でアプリ本体を動かし、Push 配信だけ Cloudflare Workers（無料枠）で行います。Firebase Functions や FCM は不要です。

## クイックセットアップ（推奨）

1. [Cloudflare API トークン](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) を作成し、Workers と KV の編集権限を付与
2. PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = "your_token"
# 秘密鍵は .env.push.local に保存（リポジトリには含めない）
npm run worker:setup
npm run build
firebase deploy --only firestore:rules,hosting
```

`npm run worker:setup` は KV 作成、`WEB_PUSH_PRIVATE_KEY` の secret 登録、Worker デプロイ、`.env.local` の `VITE_PUSH_WORKER_URL` 更新まで行います。

## 手動セットアップ

### 1. VAPID 鍵

```powershell
npx web-push generate-vapid-keys --json
```

- 公開鍵 → `workers/push/wrangler.toml` の `WEB_PUSH_PUBLIC_KEY` と `.env.local` の `VITE_WEB_PUSH_PUBLIC_KEY`
- 秘密鍵 → `wrangler secret put` のみ（コミットしない）

### 2. Cloudflare KV

```powershell
npx wrangler login
npx wrangler kv namespace create PUSH_SUBSCRIPTIONS --config workers/push/wrangler.toml
```

表示された namespace id を `workers/push/wrangler.toml` の `REPLACE_WITH_KV_NAMESPACE_ID` に貼り付け。

### 3. Worker の secret とデプロイ

```powershell
npx wrangler secret put WEB_PUSH_PRIVATE_KEY --config workers/push/wrangler.toml
npm run worker:deploy
```

### 4. フロントの環境変数

`.env.local`:

```env
VITE_PUSH_WORKER_URL="https://ivent-schedule-push.<account>.workers.dev"
VITE_WEB_PUSH_PUBLIC_KEY="your_public_key"
```

### 5. Firebase Hosting

```powershell
npm run build
firebase deploy --only firestore:rules,hosting
```

## 端末別の有効化手順

| 端末 | 手順 |
|------|------|
| PC（Chrome / Edge / Firefox） | 本番 URL でログイン → ベル →「Push通知を有効にする」→ ブラウザで許可 |
| Android（Chrome） | 同上 |
| **iPhone** | **iOS 16.4 以降**。**Safari で本番 URL を開く** → 共有 → **ホーム画面に追加** → 追加したアイコンから起動 → ベル → Push を有効化（通常の Safari タブだけでは不可） |

## 動作確認

[`docs/push-notification-testing.md`](push-notification-testing.md) を参照。

## コスト

30 人・1 日約 10 通知程度であれば Cloudflare Workers / KV と Firebase Spark の無料枠内に収まります。
