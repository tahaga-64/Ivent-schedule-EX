# デザイン部門

## 役割
UI/UXデザイン・コンポーネント設計・ブランド管理を担当する。
視認性・操作性・モバイル対応・ダーク/ライトモード対応を最優先に設計する。

## ルール
- デザインブリーフは `briefs/feature-name-brief.md`
- アセット管理は `assets/asset-list.md` に一元管理
- Tailwind CSS のクラス設計方針は `docs/tailwind-guidelines.md` に記載
- ダーク/ライトモード両方のパターンを必ずブリーフに含める
- コンポーネント設計変更は開発部門に連携する
- アニメーション（Framer Motion）の仕様もブリーフに含める
- モバイルファーストで設計し、デスクトップへの拡張を意識する

## ファイル命名
- ブリーフ: `briefs/YYYY-MM-DD-feature-name-brief.md`
- アセット一覧: `assets/asset-list.md`

## フォルダ構成
- `briefs/` - デザインブリーフ（1機能1ファイル）
- `assets/` - アセット管理・ブランドガイドライン
