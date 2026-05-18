# インフラ部門

## 役割
Firebase設定・Vercelデプロイ・セキュリティルール・CI/CDパイプラインを管理する。

## 管理対象
- **Firebase**: Firestore / Auth / Storage（セキュリティルール含む）
- **Vercel**: プロダクションデプロイ / Preview デプロイ
- **環境変数**: `.env.example` の管理・更新
- **ドメイン・SSL**: Vercel経由で管理

## ルール
- インフラ設計・変更ドキュメントは `docs/topic-name.md`
- 設定スニペット・コマンド集は `configs/` に保存
- Firestore / Storage のセキュリティルール変更は必ずQA部門にレビュー依頼
- 本番反映前に Preview 環境で動作確認する
- 環境変数を増やした場合は `.env.example` を必ず更新する
- APIキー・シークレットはファイルに記録しない
- Firebaseの料金・使用量は月次でチェックし secretary/notes/ に記録する

## ファイル命名
- ドキュメント: `docs/topic-name.md`
- 設定メモ: `configs/service-name-config.md`

## フォルダ構成
- `docs/` - インフラ設計書・変更履歴
- `configs/` - 設定スニペット・運用コマンド集
