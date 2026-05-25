# 運用手順書 — Ivent Manager

**作成日**: 2026-05-25
**担当**: 運用・CS 部門
**バージョン**: 1.0
**対象環境**: 本番環境（Vercel + Firebase + Cloudinary）

---

## 目次

1. [本番移行前チェックリスト](#1-本番移行前チェックリスト)
2. [日常運用フロー](#2-日常運用フロー)
3. [障害発生時の対応フロー](#3-障害発生時の対応フロー)
4. [管理画面 確認ポイント](#4-管理画面-確認ポイント)
5. [ユーザーサポート対応フロー](#5-ユーザーサポート対応フロー)
6. [データバックアップ方針](#6-データバックアップ方針)
7. [緊急連絡・エスカレーション手順](#7-緊急連絡エスカレーション手順)

---

## 1. 本番移行前チェックリスト

本番環境への切り替えを実施する前に、以下の全項目を確認・完了させること。

### 1-1. Vercel 環境設定

- [ ] **Environment Variables の確認**（Production 環境に設定済みか）
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_DATABASE_ID`
  - `VITE_FIREBASE_VAPID_KEY`（FCM プッシュ通知用）
  - `CLOUDINARY_API_KEY`（サーバーサイド削除 API 用）
  - `CLOUDINARY_API_SECRET`（サーバーサイド削除 API 用）
- [ ] 本番用カスタムドメインの設定と DNS 確認
- [ ] HTTPS（SSL）が有効になっているか確認
- [ ] `vercel.json` の rewrites 設定が正しいか確認
- [ ] Production ブランチ（main / master）が正しく設定されているか

### 1-2. Firebase 設定

- [ ] **Firebase コンソール > Authentication > 承認済みドメイン** に本番ドメインを追加
  - 例: `yourdomain.com`（カスタムドメイン使用時）
  - 例: `your-project.vercel.app`（Vercel サブドメイン使用時）
  - ※ 追加しないと Google ログインが `auth/unauthorized-domain` エラーになる
- [ ] Firestore のセキュリティルール（`firestore.rules`）が Production 環境にデプロイされているか確認
- [ ] Firebase コンソール > Firestore > ルールタブで現在適用中のルールを目視確認
- [ ] `allowedUsers` コレクションに本番ユーザー 4名のメールアドレスが登録されているか確認
- [ ] FCM VAPID キーが Firebase コンソール > Cloud Messaging > ウェブプッシュ証明書から取得・設定済みか

### 1-3. Cloudinary 設定

- [ ] `upload_preset: "events photo"` が Cloudinary コンソールで Unsigned upload として設定されているか確認
- [ ] アップロード先フォルダ（`events/`）が存在するか確認
- [ ] `/api/deletePhoto` の Serverless Function が Cloudinary API キー/シークレットで正しく動作するか確認

### 1-4. アプリ動作確認（本番環境）

- [ ] Google ログイン → 許可ユーザーでログイン成功
- [ ] 非許可メールアドレスでログイン → アクセス拒否画面が表示されるか
- [ ] イベント作成・編集・削除が正常に動作するか（編集権限ユーザーで確認）
- [ ] 準備物リストの追加・更新が動作するか（全員で確認）
- [ ] 写真アップロード・削除が正常に動作するか
- [ ] プッシュ通知の許可 → 通知受信が動作するか
- [ ] カレンダービュー・リストビューが正常に表示されるか
- [ ] スマートフォン（iOS Safari / Android Chrome）での動作確認

### 1-5. セキュリティ確認

- [ ] `firestore.rules` に開発用の緩和ルール（`allow read, write: if true;` 等）が残っていないか
- [ ] `.env` ファイルや API シークレットが Git に含まれていないか（`.gitignore` 確認）
- [ ] Cloudinary の Upload Preset が Unsigned（署名なしアップロード）で設定されており、ストレージ容量の意図しない増加を防ぐためフォルダ制限が設定されているか

---

## 2. 日常運用フロー

### 2-1. 定期確認（週次推奨）

| 確認項目 | 確認場所 | 目安 |
|---------|---------|------|
| Vercel デプロイ状況 | Vercel ダッシュボード > Deployments | 最新デプロイが READY ステータスか |
| Firebase 使用量 | Firebase コンソール > Usage | 無料枠の 50% を超えていないか |
| Cloudinary 使用量 | Cloudinary コンソール > Dashboard | ストレージ・帯域の使用量確認 |
| Firestore エラーログ | Firebase コンソール > Firestore > モニタリング | エラー率が急増していないか |

### 2-2. イベント運用フロー（通常業務）

```
[新規イベント作成]
  └─ 編集権限ユーザー（taoki0183, haruhito3901, m.takada.kp）がログイン
  └─ 「新規イベント」ボタンからイベントを作成
  └─ 会場名・開始日・地域・種別を入力して保存
  └─ 全ユーザーにプッシュ通知（FCM）+ アプリ内通知が送信される

[イベント更新]
  └─ 編集権限ユーザーがイベントを開いて編集
  └─ 詳細メモ・担当者割り当て・準備物リストは全員が編集可能
  └─ 保存ボタンで Firestore に即時反映

[写真アップロード]
  └─ 編集権限ユーザーがイベント詳細 > 写真タブを開く
  └─ 最大 5枚まで（10 MB/枚）アップロード可能
  └─ Cloudinary に保存され、Firestore に URL が記録される
```

### 2-3. ユーザー管理フロー

新規ユーザーを追加する場合（後述の「ユーザーサポート対応フロー」も参照）:

1. Firebase コンソール > Firestore > `allowedUsers` コレクションを開く
2. 「ドキュメントを追加」をクリック
3. ドキュメント ID にメールアドレスを入力（例: `newuser@gmail.com`）
4. フィールドに `email: "newuser@gmail.com"` （string 型）を追加して保存
5. 追加したユーザーにアプリ URL を案内する

**編集権限を付与する場合（追加作業）:**
1. `src/lib/permissions.ts` の `EVENT_EDITOR_EMAILS` 配列にメールアドレスを追加
2. `firestore.rules` の `isEventEditor()` 関数内のメールアドレスリストにも追加
3. Git にコミット → Vercel 自動デプロイ → Firebase にルールをデプロイ

---

## 3. 障害発生時の対応フロー

### 3-1. 障害レベル定義

| レベル | 内容 | 例 |
|--------|------|-----|
| P1 (緊急) | アプリが完全に使えない | ログインできない、白画面、全データが見えない |
| P2 (高) | 主要機能が使えない | 保存できない、通知が届かない |
| P3 (中) | 一部機能に問題 | 写真アップロード失敗、一部イベントが表示されない |
| P4 (低) | 軽微な表示崩れ | UI の見た目の問題、操作性の低下 |

### 3-2. 初動対応フロー（P1 / P2 障害）

```
1. 障害を認知
   └─ ユーザーからの報告 or 自己発見

2. 現象の確認（5分以内）
   └─ 自分でアプリにアクセスして再現確認
   └─ ブラウザのコンソールエラーを確認（F12 > Console）
   └─ Vercel のデプロイ状況を確認（READY か ERROR か）

3. 原因の切り分け
   ├─ Vercel デプロイ失敗 → 最後の正常デプロイに Rollback
   ├─ Firebase 障害 → https://status.firebase.google.com/ を確認
   ├─ Cloudinary 障害 → https://status.cloudinary.com/ を確認
   └─ コード起因 → エラーログを確認して修正

4. 暫定対応または復旧
   └─ Vercel Rollback: ダッシュボード > Deployments > 正常版 > 「...」> Redeploy
   └─ Firestore ルール問題: Firebase コンソールから直接ルールを修正してデプロイ

5. ユーザーへの状況通知
   └─ グループチャット等で「現在障害を調査中」を連絡
   └─ 復旧後に「復旧しました」を連絡

6. 事後対応
   └─ 原因と対応内容を .company/ops-cs/issues/ に記録
```

### 3-3. よくある障害と対処法

| 症状 | 原因 | 対処法 |
|------|------|--------|
| Google ログインが `auth/unauthorized-domain` エラー | Firebase の承認済みドメインに本番ドメインが未登録 | Firebase コンソール > Auth > 承認済みドメインにドメインを追加 |
| 「Firebase 設定が不足しています」画面が表示される | Vercel の Environment Variables が未設定 | Vercel コンソール > Settings > Environment Variables で確認・追加 |
| ログインできるがアプリが白画面 | デプロイのビルドエラー | Vercel のデプロイログを確認し、エラー内容に応じて対処 |
| 保存できない（権限エラー） | Firestore ルールの問題 または 編集権限外ユーザー | firestore.rules を確認・修正してデプロイ |
| 写真がアップロードされない | Cloudinary の Upload Preset 設定エラー または API 制限 | Cloudinary コンソールで Upload Preset の設定を確認 |
| プッシュ通知が届かない | VAPID キー未設定 または Service Worker の問題 | `VITE_FIREBASE_VAPID_KEY` が Vercel に設定されているか確認 |
| データが表示されない | Firestore の onSnapshot 購読エラー | ブラウザコンソールのエラーを確認、Firebase の認証状態を確認 |

---

## 4. 管理画面 確認ポイント

### 4-1. Vercel ダッシュボード

**URL**: https://vercel.com/dashboard

| 確認項目 | 場所 | 確認内容 |
|---------|------|---------|
| デプロイ状況 | プロジェクト > Deployments | 最新が「Ready」か「Error」か |
| ビルドログ | デプロイ一覧 > 各デプロイ > Build Logs | TypeScript エラー、ビルド失敗の詳細 |
| 関数ログ | プロジェクト > Functions | `/api/notify`, `/api/deletePhoto` のエラー |
| 環境変数 | プロジェクト > Settings > Environment Variables | 本番用変数が全て設定されているか |
| ドメイン | プロジェクト > Settings > Domains | カスタムドメインの SSL 有効期限 |
| 使用量 | アカウント > Usage | 帯域・関数実行時間の月間使用量 |

### 4-2. Firebase コンソール

**URL**: https://console.firebase.google.com/

**Authentication**
- Authentication > Users: ログイン済みユーザー一覧の確認
- Authentication > 設定 > 承認済みドメイン: 本番ドメインが登録されているか

**Firestore Database**
- Firestore > データ: `allowedUsers`, `events`, `users`, `staff` コレクションの確認
- Firestore > ルール: 現在デプロイ中のセキュリティルールの確認
- Firestore > モニタリング: 読み取り/書き込み数のグラフ、エラー率

**Cloud Messaging**
- Messaging > ウェブプッシュ証明書: VAPID キーの確認

**使用量の確認（無料枠監視）**
- プロジェクト設定 > 使用量と請求: Spark プランの無料枠に対する使用量割合

### 4-3. Cloudinary コンソール

**URL**: https://cloudinary.com/console

| 確認項目 | 場所 |
|---------|------|
| ストレージ使用量 | Dashboard > Storage |
| 帯域使用量 | Dashboard > Bandwidth |
| アップロード数 | Media Library > `events/` フォルダ |
| Upload Preset 設定 | Settings > Upload > Upload presets > "events photo" |

**定期クリーンアップ**（月 1回推奨）
- Media Library で削除済みイベントに紐づいた孤立ファイルがないか確認
- 不要な画像は手動削除してストレージを節約

---

## 5. ユーザーサポート対応フロー

### 5-1. アクセス権限追加（新規ユーザーを招待する手順）

**概要**: 本アプリは `allowedUsers` コレクションに登録されたメールアドレスのみ Google ログインが許可される招待制。

**手順（閲覧・参加者として追加する場合）:**

1. 追加したいユーザーの Gmail アドレスを確認
2. [Firebase コンソール](https://console.firebase.google.com/) にログイン
3. 対象プロジェクト > Firestore Database > データ を開く
4. `allowedUsers` コレクションを選択
5. 「ドキュメントを追加」をクリック
6. ドキュメント ID: `{ユーザーのメールアドレス}` （例: `newmember@gmail.com`）
7. フィールドを追加:
   - フィールド名: `email`
   - 型: string
   - 値: `newmember@gmail.com`
8. 「保存」をクリック
9. ユーザーにアプリ URL を案内し、Google アカウントでログインするよう伝える

**手順（編集権限も付与する場合）:**
上記に加えて以下のコード変更が必要（エンジニア作業）:
1. `src/lib/permissions.ts` の `EVENT_EDITOR_EMAILS` にメールアドレスを追加
2. `firestore.rules` の `isEventEditor()` 関数内のリストにメールアドレスを追加
3. Git コミット → Vercel デプロイ → Firestore ルールデプロイ

### 5-2. アクセス権限削除（ユーザーを退去させる手順）

1. Firebase コンソール > Firestore > `allowedUsers` コレクション
2. 対象ユーザーのメールアドレスのドキュメントを開く
3. ドキュメントを削除
4. 必要に応じて Firebase Authentication > Users から当該ユーザーを削除
5. 編集権限があった場合は `permissions.ts` と `firestore.rules` からも削除してデプロイ

### 5-3. よくあるユーザー問い合わせ対応

| 問い合わせ内容 | 対応手順 |
|--------------|---------|
| 「ログインしても弾かれる」 | `allowedUsers` に当該メールアドレスが登録されているか確認。未登録なら追加。 |
| 「イベントが保存できない」 | 編集権限（EVENT_EDITOR_EMAILS）に登録されているか確認。ブラウザコンソールのエラーも確認。 |
| 「通知が来ない」 | ブラウザの通知許可設定を確認するよう案内。VAPID キーが設定されているか確認。 |
| 「写真がアップロードできない」 | ファイルサイズ（10 MB 以下）と形式（画像ファイル）を確認するよう案内。 |
| 「スマホで編集できない」 | 仕様上、モバイルでのイベント本体編集は無効化されている（セキュリティ設計）。PCでの操作を案内。 |
| 「表示名を変更したい」 | Google アカウントの表示名（プロフィール）を変更後、アプリにログインし直すよう案内。 |

---

## 6. データバックアップ方針

### 6-1. 現状の自動バックアップ

| サービス | バックアップ状況 |
|---------|---------------|
| Firebase Firestore | Spark プランには自動バックアップなし（Blaze プランでスケジュールエクスポート可能） |
| Cloudinary | 無料プランには自動バックアップなし（クラウド上に保存） |
| Vercel（コード） | Git リポジトリがバックアップ代わり |

### 6-2. 手動バックアップ手順（月 1回推奨）

**Firestore データのエクスポート:**

```bash
# Firebase CLI を使用（要: Blaze プランまたは firebase-admin SDK）
# 現状 Spark プランのため、手動エクスポートを実施

# オプション 1: Firebase コンソールから手動エクスポート
# Firestore > インポート/エクスポート > エクスポート
# ※ Blaze プランへの一時的なアップグレードが必要

# オプション 2: scripts/ ディレクトリのスクリプトを使用してデータを取得
# (firebase-admin を使用した JSON エクスポートスクリプトを整備すること)
```

**現実的な暫定対策（Spark プランのまま）:**
1. Firebase コンソール > Firestore > データタブを開く
2. 重要な `events` コレクションのドキュメントを定期的にスクリーンショット or コピー保存
3. または、ブラウザの開発者ツールで Firestore の読み取りデータを JSON として保存

**推奨（本番移行後）:**
- Firebase Blaze プランに切り替え（最初の 1 GB エクスポートは無料）
- Cloud Storage への定期自動エクスポートを設定
- バックアップファイルは Google Drive などに保管

### 6-3. バックアップ保持方針

| データ種別 | 保持期間 | 保存先 |
|-----------|---------|--------|
| Firestore 全データ | 最新 3世代（月次） | Google Drive / ローカル |
| 写真（Cloudinary） | 削除操作を行わない限り永続 | Cloudinary クラウド |
| コード | 永続（Git 履歴） | GitHub / Git リポジトリ |

---

## 7. 緊急連絡・エスカレーション手順

### 7-1. 連絡先一覧

| 役割 | メールアドレス | 対応範囲 |
|------|-------------|---------|
| 編集者 / 主担当 | taoki0183@gmail.com | 全体管理・最終判断 |
| 編集者 | haruhito3901@gmail.com | イベント編集・運用 |
| 編集者 | m.takada.kp@gmail.com | イベント編集・運用 |

### 7-2. エスカレーションフロー

```
P4 (軽微) → 次の定例作業時に対応
P3 (中)   → 当日中に担当者が確認・対応
P2 (高)   → 2時間以内に対応開始 → taoki0183@ に連絡
P1 (緊急) → 即時対応 → taoki0183@ に連絡 → 全編集者に共有
```

### 7-3. 外部サービス障害時の連絡先

| サービス | 障害ページ | サポート窓口 |
|---------|-----------|------------|
| Firebase | https://status.firebase.google.com/ | Google Cloud サポート |
| Vercel | https://www.vercel-status.com/ | Vercel サポート（Pro プラン以上） |
| Cloudinary | https://status.cloudinary.com/ | Cloudinary サポート |

### 7-4. 本番環境の管理者アクセス手順

以下のサービスへのアクセス権限は、オーナー（taoki0183@gmail.com）が保持すること。

| サービス | 管理者権限保持者 | アクセス手順 |
|---------|--------------|------------|
| Firebase | オーナー | console.firebase.google.com にログイン |
| Vercel | オーナー | vercel.com/dashboard にログイン |
| Cloudinary | オーナー | cloudinary.com/console にログイン |
| Git リポジトリ | オーナー | 対象リポジトリの Admin 権限 |

**緊急時のロールバック手順:**
1. Vercel > Deployments > 正常だった直近のデプロイを選択
2. 「...（メニュー）」> 「Redeploy」を実行
3. 数分でロールバック完了
4. Firebase のルール変更が原因の場合は Firebase コンソールから直接ルールを前バージョンに戻す

---

## 付録: 重要 URL 一覧

| サービス | URL |
|---------|-----|
| Vercel ダッシュボード | https://vercel.com/dashboard |
| Firebase コンソール | https://console.firebase.google.com/ |
| Cloudinary コンソール | https://cloudinary.com/console |
| Firebase ステータス | https://status.firebase.google.com/ |
| Vercel ステータス | https://www.vercel-status.com/ |
| Cloudinary ステータス | https://status.cloudinary.com/ |

---

*このドキュメントは 2026-05-25 に作成されました。変更が生じた場合はバージョン番号と日付を更新してください。*
