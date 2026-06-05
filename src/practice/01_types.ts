// =============================================================
// 01_types.ts — TypeScript の「型」基礎
// このアプリ（Ivent-schedule-EX）の実際のコードを例に解説します
// =============================================================


// ─────────────────────────────────────────
// ① プリミティブ型（基本の型）
// ─────────────────────────────────────────

// string : 文字列
const venueName: string = 'モラージュ菖蒲';

// number : 整数・小数どちらも同じ型
const unitPrice: number = 1200;
const taxRate: number = 0.1;

// boolean : true か false のどちらか
const isEditable: boolean = true;

// ↓ 型を書かなくても、代入した値から TypeScript が自動で推論する（型推論）
const autoInferred = 'これは自動的に string と判断される';


// ─────────────────────────────────────────
// ② 配列型
// ─────────────────────────────────────────

// string[] : 文字列の配列
const regions: string[] = ['関東', '近畿', '九州'];

// number[] : 数値の配列
const quantities: number[] = [1, 2, 5, 10];

// Array<T> という書き方も同じ意味（T はあとで説明するジェネリクス）
const tags: Array<string> = ['魚釣り', 'ファミリー'];


// ─────────────────────────────────────────
// ③ ユニオン型（複数の型のどれかを許可）
// ─────────────────────────────────────────

// string | null : 文字列か null のどちらか
// ユーザーがログインしていないときは null になる
let userEmail: string | null = null;
userEmail = 'taoki0183@gmail.com'; // ← あとから文字列を代入しても OK

// string | number : 文字列か数値のどちらか
type IdOrName = string | number;
const eventId: IdOrName = 'abc123'; // 文字列でも
const itemId: IdOrName = 42;        // 数値でもOK


// ─────────────────────────────────────────
// ④ リテラル型（特定の値しか許可しない）
// ─────────────────────────────────────────

// このアプリのイベントステータスは決まった文字列しかとらない
// → それをリテラル型で表現する
type EventStatus =
  | 'scheduled'   // 予定
  | 'in_progress' // 準備中
  | 'waiting'     // 入荷待ち
  | 'ready'       // 準備完了
  | 'completed'   // 完了
  | 'cancelled';  // キャンセル

// EventStatus 型の変数には上記6種類しか代入できない
let status: EventStatus = 'scheduled';
status = 'ready'; // OK
// status = 'unknown'; // ← これはエラー！ 'unknown' は EventStatus に含まれない


// ─────────────────────────────────────────
// ⑤ undefined と null
// ─────────────────────────────────────────

// undefined : 値がまだ設定されていない
// null      : 意図的に「空」を表す
let selectedEvent: string | undefined = undefined; // まだ何も選ばれていない
let deletedItem: string | null = null;             // 削除されて存在しない


// ─────────────────────────────────────────
// ⑥ any と unknown（できるだけ使わない）
// ─────────────────────────────────────────

// any : 型チェックを完全に無効化する（危険）
let anything: any = 'なんでもOK';
anything = 123;     // エラーにならない
anything = true;    // エラーにならない（でも型安全でない）

// unknown : any より安全。使う前に型を確認しないとエラーになる
let saferAny: unknown = 'まだ型不明';
// saferAny.toUpperCase(); // ← エラー！ 型を確認してから使う必要がある
if (typeof saferAny === 'string') {
  saferAny.toUpperCase(); // ← typeof で確認してからなら OK
}


// ─────────────────────────────────────────
// ⑦ void と never
// ─────────────────────────────────────────

// void : 戻り値のない関数の戻り値型
function logMessage(msg: string): void {
  console.log(msg);
  // return は不要（あっても undefined なら OK）
}

// never : 絶対に終わらない・必ず例外を投げる関数
function throwError(message: string): never {
  throw new Error(message);
  // ここには到達しない
}


// ─────────────────────────────────────────
// ⑧ 型エイリアス（type）
// ─────────────────────────────────────────

// type キーワードで型に名前をつける
type Region = '関東' | '近畿' | '九州' | '四国' | '東海';
type ViewMode = 'home' | 'calendar' | 'prep' | 'archive' | 'master' | 'fish' | 'layout';

// 複雑な型にも名前をつけられる
type Coordinate = {
  x: number;
  y: number;
};

const position: Coordinate = { x: 100, y: 200 };


// ─────────────────────────────────────────
// まとめ：このファイルで出てきた型
// ─────────────────────────────────────────
// string         → 文字列
// number         → 数値
// boolean        → true/false
// string[]       → 配列
// A | B          → ユニオン型（AまたはB）
// 'specific'     → リテラル型（特定の文字列のみ）
// undefined      → 未設定
// null           → 意図的な空
// any            → 型チェック無効（非推奨）
// unknown        → 安全な any
// void           → 戻り値なし
// never          → 絶対に返らない
// type Foo = ... → 型に名前をつける
