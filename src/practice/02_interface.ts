// =============================================================
// 02_interface.ts — interface と type の「オブジェクト型」
// 実際のアプリの型定義（types.ts）を元に解説します
// =============================================================


// ─────────────────────────────────────────
// ① interface（インターフェース）
// ─────────────────────────────────────────

// interface はオブジェクトの「設計図」
// 「このオブジェクトにはこのプロパティが必要」を定義する
interface User {
  uid: string;          // ユーザーID（必須）
  email: string;        // メールアドレス（必須）
  displayName: string;  // 表示名（必須）
}

// User 型の変数には uid / email / displayName が必要
const currentUser: User = {
  uid: 'abc123',
  email: 'taoki0183@gmail.com',
  displayName: '太田',
};


// ─────────────────────────────────────────
// ② ? をつけると「省略可能」（オプショナル）
// ─────────────────────────────────────────

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;  // ? → あってもなくてもOK
  photoURL?: string;     // ? → あってもなくてもOK
}

// displayName と photoURL を省略してもエラーにならない
const profile: UserProfile = {
  uid: 'xyz789',
  email: 'haruhito3901@gmail.com',
};


// ─────────────────────────────────────────
// ③ 実際のアプリで使われている Event 型（簡略版）
// ─────────────────────────────────────────

// これが src/types.ts にある Event 型に近い構造
interface Event {
  id: string;             // Firestore のドキュメントID
  venue: string;          // 会場名（例: "モラージュ菖蒲"）
  start: string;          // 開始日（例: "2026-06-03"）
  end?: string;           // 終了日（省略可能）
  region: string;         // 地域（例: "関東"）
  type: string;           // イベント種別（例: "魚釣り"）
  status: EventStatus;    // ↓ 別で定義したリテラル型を再利用
  staff?: string[];       // スタッフ名の配列（省略可能）
  note?: string;          // 備考（省略可能）
  emoji?: string;         // アイコン絵文字（省略可能）
}

// 別ファイルで定義した型をここで参照している
type EventStatus = 'scheduled' | 'in_progress' | 'waiting' | 'ready' | 'completed' | 'cancelled';


// ─────────────────────────────────────────
// ④ interface の継承（extends）
// ─────────────────────────────────────────

// 既存の interface に追加のプロパティを加えた新しい型を作れる
interface MasterItem {
  id: string;
  name: string;           // 品名（例: "テーブルクロス"）
  unitPrice: number;      // 単価
  defaultQuantity: number; // デフォルト数量
  note: string;           // メモ
  url?: string;           // 購入リンク（省略可能）
}

// MasterItem に「在庫数」を追加した拡張型
interface MasterItemWithStock extends MasterItem {
  currentStock: number;   // extends で MasterItem の全プロパティを引き継ぐ
}

const tableCloth: MasterItemWithStock = {
  id: 'item001',
  name: 'テーブルクロス',
  unitPrice: 500,
  defaultQuantity: 5,
  note: '白・120cm×120cm',
  url: 'https://example.com',
  currentStock: 20, // ← 拡張したプロパティ
};


// ─────────────────────────────────────────
// ⑤ type vs interface の違い
// ─────────────────────────────────────────

// type でもオブジェクト型を定義できる（見た目はほぼ同じ）
type Coordinate = {
  x: number;
  y: number;
};

// 実用上の違い：
// - interface は extends で継承しやすい → クラスやオブジェクト設計に向く
// - type はユニオン型など複雑な型合成に向く
// → React アプリでは type を使うことが多い（このアプリもほぼ type）


// ─────────────────────────────────────────
// ⑥ インデックスシグネチャ（動的なキー）
// ─────────────────────────────────────────

// キーが動的な場合（何が来るか事前にわからない）
interface StyleMap {
  [key: string]: string; // key は string、value も string
}

// 使用例：地域名をキーにしたスタイル定義
const regionColors: StyleMap = {
  '関東': '#3b82f6',
  '近畿': '#8b5cf6',
  '九州': '#ec4899',
};

// このアプリの constants.ts でも使われているパターン
// Record<string, string> という書き方も同じ意味
const regionColorsAlt: Record<string, string> = {
  '関東': '#3b82f6',
};


// ─────────────────────────────────────────
// まとめ
// ─────────────────────────────────────────
// interface Foo { ... }   → オブジェクトの設計図
// prop?: Type             → 省略可能なプロパティ
// extends                 → 継承（別の interface を引き継ぐ）
// [key: string]: Type     → 動的なキーを持つオブジェクト
// Record<K, V>            → インデックスシグネチャの省略形
