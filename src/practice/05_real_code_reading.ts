// =============================================================
// 05_real_code_reading.ts — 実際のコードを読んでみる
// App.tsx や types.ts から抜粋したコードの意味を解説します
// =============================================================


// ─────────────────────────────────────────
// ① constants.ts の REGION_STYLE を読む
// ─────────────────────────────────────────

// 実際のコード（constants.ts より）:
//
// export const REGION_STYLE: Record<string, { dot: string; bg: string; text: string }> = {
//   '関東': { dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700' },
//   '近畿': { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
// };

// 分解して読む:
// Record<string, { dot: string; bg: string; text: string }>
//   ↓
// Record<キーの型, 値の型>
//   ↓
// キーは string、値は { dot: string; bg: string; text: string } というオブジェクト

type RegionStyle = {
  dot: string;   // CSS クラス名（Tailwind の dot 色）
  bg: string;    // CSS クラス名（背景色）
  text: string;  // CSS クラス名（文字色）
};

// Record<string, RegionStyle> は下と同じ意味
// { [key: string]: RegionStyle }

const REGION_STYLE: Record<string, RegionStyle> = {
  '関東': { dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  '近畿': { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
};

// 使い方: REGION_STYLE['関東'].dot → 'bg-blue-500'


// ─────────────────────────────────────────
// ② useMemo を読む
// ─────────────────────────────────────────

// 実際のコード（HomeView.tsx より）:
//
// const { todayEvents, upcomingWeek } = useMemo(() => {
//   const today = new Date();
//   const todayEvents = events.filter(ev => isSameDay(ev.start, today));
//   const upcomingWeek = events.filter(ev => isWithinDays(ev.start, 7));
//   return { todayEvents, upcomingWeek };
// }, [events]);

// 読み方:
// useMemo(計算する関数, [依存する値の配列])
//   → 依存する値が変わった時だけ再計算する（パフォーマンス最適化）
//   → 戻り値の型は return しているオブジェクトから自動推論される

// { todayEvents, upcomingWeek } = useMemo(...)
//   → 分割代入: オブジェクトのプロパティを変数として取り出す

// 分割代入の例:
const result = { todayEvents: ['イベントA'], upcomingWeek: ['イベントB', 'イベントC'] };
const { todayEvents, upcomingWeek } = result;
// todayEvents → ['イベントA']
// upcomingWeek → ['イベントB', 'イベントC']


// ─────────────────────────────────────────
// ③ Array のメソッド（filter・map・find）を読む
// ─────────────────────────────────────────

type Event = {
  id: string;
  venue: string;
  status: 'scheduled' | 'completed';
  region: string;
};

const events: Event[] = [
  { id: '1', venue: 'モラージュ菖蒲',   status: 'scheduled', region: '関東' },
  { id: '2', venue: 'ベスト電器イオン',  status: 'completed', region: '九州' },
  { id: '3', venue: 'エディオン販路',   status: 'scheduled', region: '近畿' },
];

// filter : 条件に合う要素だけ取り出す → 同じ型の配列を返す
const scheduledEvents = events.filter(ev => ev.status === 'scheduled');
// → [{ id: '1', ... }, { id: '3', ... }]

// map : 各要素を変換する → 新しい配列を返す
const venueNames = events.map(ev => ev.venue);
// → ['モラージュ菖蒲', 'ベスト電器イオン', 'エディオン販路']

// find : 最初に条件に合う要素を1つ返す（見つからなければ undefined）
const kanto = events.find(ev => ev.region === '関東');
// → { id: '1', venue: 'モラージュ菖蒲', ... } | undefined

// reduce : 配列をたたんで1つの値にする
const totalByRegion = events.reduce<Record<string, number>>((acc, ev) => {
  //                           ↑ ジェネリクスで戻り値の型を指定
  acc[ev.region] = (acc[ev.region] ?? 0) + 1;
  //                               ↑ ?? は「左辺が null/undefined なら右辺を使う」
  return acc;
}, {});
// → { '関東': 1, '九州': 1, '近畿': 1 }


// ─────────────────────────────────────────
// ④ オプショナルチェーン（?.）を読む
// ─────────────────────────────────────────

type UserMaybe = {
  profile?: {
    displayName?: string;
  };
};

const user: UserMaybe = {};

// ?. : 左辺が null/undefined なら undefined を返す（エラーにならない）
const name = user.profile?.displayName;
// user.profile が undefined → displayName にアクセスせず undefined を返す

// このアプリで出てくる例:
// user.email?.includes('@gmail.com')
//   → user.email が null なら undefined、あれば includes() を実行


// ─────────────────────────────────────────
// ⑤ Nullish Coalescing（??）を読む
// ─────────────────────────────────────────

const rawValue: string | null = null;

// ?? : 左辺が null または undefined のときだけ右辺を返す
const displayValue = rawValue ?? '未設定';
// → '未設定'（rawValue が null なので）

// || との違い:
// ||  は falsy（0, '', false, null, undefined）全てで右辺を使う
// ??  は null/undefined のときだけ右辺を使う

const count = 0;
const withOr  = count || 10;  // → 10（0 は falsy なので）
const withNull = count ?? 10; // → 0（0 は null/undefined ではないので）


// ─────────────────────────────────────────
// ⑥ 型ガード（typeof / instanceof）を読む
// ─────────────────────────────────────────

// TypeScript が型を絞り込む条件文

function processInput(input: string | number) {
  // typeof で型を確認すると、ブロック内の型が絞り込まれる
  if (typeof input === 'string') {
    // このブロック内では input は string 型として扱われる
    console.log(input.toUpperCase()); // string のメソッドが使える
  } else {
    // このブロック内では input は number 型
    console.log(input.toFixed(2)); // number のメソッドが使える
  }
}

// instanceof でクラスの種類を確認
function handleError(err: unknown) {
  if (err instanceof Error) {
    // err は Error クラスのインスタンスと確定
    console.log(err.message); // Error.message が使える
  }
}


// ─────────────────────────────────────────
// まとめ：よく出てくる記法
// ─────────────────────────────────────────
// Record<K, V>        → キーがK型・値がV型のオブジェクト
// { a, b } = obj      → 分割代入（オブジェクトのプロパティを取り出す）
// arr.filter(fn)      → 条件に合う要素だけの配列
// arr.map(fn)         → 各要素を変換した配列
// arr.find(fn)        → 最初に条件を満たす要素（or undefined）
// arr.reduce(fn, {})  → 配列を1つの値にたたむ
// obj?.prop           → null/undefined セーフなアクセス
// val ?? default      → null/undefined のときだけデフォルト値を使う
// typeof val === 'x'  → 型を確認して絞り込む（型ガード）
