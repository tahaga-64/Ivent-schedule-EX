# EX Event Manager

EX事業部向けのイベント管理アプリ。
従来スプレッドシートで管理していたイベント日程・準備物・担当者管理を、リアルタイム共有可能なWebアプリとして再設計。

⸻

## 背景

EX事業部では、イベントの日程管理や準備物の確認をスプレッドシートで運用していましたが、

- 情報が見づらい
- 更新漏れが発生しやすい
- 状況共有が難しい
- スマホで扱いづらい

などの課題がありました。

もともと従業員向けスケジュールアプリを制作した経験から、
「イベント管理もアプリ化できないか」という要望を受け、本プロジェクトを開発しています。

⸻

## コンセプト

「現場で使いやすいイベント管理」

- 視認性
- 操作性
- リアルタイム共有
- モバイル対応
- ダークモードを含むUI体験

を重視した設計を目指しています。

⸻

## 特徴（現状）

- イベント一覧管理
- イベント作成 / 編集
- リアルタイム同期
- Firebase Authentication
- Googleログイン
- ダーク / ライトモード
- レスポンシブUI
- アニメーションUI

⸻

## 機能

- 通知機能
- 担当者割り当て
- 準備物チェックリスト
- カレンダー表示
- イベント進行ステータス
- AI補助機能
- 権限管理

⸻

## 技術スタック

### フロントエンド
- React 19.0.1
- TypeScript 5.8.2
- Vite 6.2.3（ビルドツール）
- Tailwind CSS 4.1.14
- Framer Motion 12.23.24（motion/react）
- Lucide React 0.546.0（アイコン）

### バックエンド / インフラ
- Firebase Firestore（データベース）
- Firebase Auth（認証 / Google OAuth）

### その他
- @google/genai 1.29.0
- Express 4.21.2

⸻

## Architecture

- Monolithic SPA architecture
- Firestore onSnapshot によるリアルタイム同期
- Firebase中心のサーバーレス構成
- CSS Variables + Tailwind dark: によるテーマ切替

⸻

## Development Flow

- Claude を用いた要件整理・壁打ち
- Google AI Studio による初期プロトタイプ生成
- Cursor を活用したUI改善・機能実装

AIを補助的に活用しながら、現場課題に合わせた改善を継続中。
