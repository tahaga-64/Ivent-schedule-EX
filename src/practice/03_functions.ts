// =============================================================
// 03_functions.ts — TypeScript の「関数」と型注釈
// このアプリで実際に使われているパターンを中心に解説します
// =============================================================


// ─────────────────────────────────────────
// ① 基本的な関数の型注釈
// ─────────────────────────────────────────

// 引数と戻り値に型をつける
// (引数名: 型): 戻り値の型 { ... }
function add(a: number, b: number): number {
  return a + b; // number を返すので戻り値型は number
}

// 文字列を受け取って文字列を返す
function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`; // 例: 1200 → "¥1,200"
}

// 何も返さない関数は void
function logError(message: string): void {
  console.error(`[ERROR] ${message}`);
}


// ─────────────────────────────────────────
// ② オプショナル引数（? をつける）
// ─────────────────────────────────────────

// 引数に ? をつけると「渡さなくてもよい」引数になる
// オプショナル引数は必ず最後に置く
function formatDate(dateStr: string, showYear?: boolean): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (showYear) {
    return `${date.getFullYear()}/${month}/${day}`;
  }
  return `${month}/${day}`;
}

// 呼び出し方
formatDate('2026-06-05');          // showYear を省略 → undefined として扱われる
formatDate('2026-06-05', true);    // showYear あり → year を表示


// ─────────────────────────────────────────
// ③ デフォルト引数
// ─────────────────────────────────────────

// = で初期値を設定できる
function createItem(name: string, quantity: number = 1): string {
  return `${name} × ${quantity}`;
}

createItem('テーブルクロス');     // quantity を省略 → 1 が使われる
createItem('マイク', 3);          // quantity = 3


// ─────────────────────────────────────────
// ④ アロー関数（Arrow Function）
// ─────────────────────────────────────────

// React ではほぼすべての関数がアロー関数で書かれる
// const 関数名 = (引数): 戻り値型 => { 処理 }

const multiply = (a: number, b: number): number => {
  return a * b;
};

// 1行なら {} と return を省略できる（暗黙のreturn）
const double = (n: number): number => n * 2;

// このアプリでよく出てくるパターン
const isCompleted = (status: string): boolean => status === 'completed';


// ─────────────────────────────────────────
// ⑤ 関数型（関数を変数や引数として渡す）
// ─────────────────────────────────────────

// 「関数を受け取る引数」の型注釈
// (引数名: 引数の型) => 戻り値の型

// onClick は「引数なし・戻り値なし」の関数を受け取る
interface ButtonProps {
  label: string;
  onClick: () => void;
}

// onSelect は「string を受け取り・何も返さない」関数を受け取る
interface SelectProps {
  options: string[];
  onSelect: (value: string) => void;
}

// 使用例：関数を引数として渡す
function runWithLogging(task: () => void): void {
  console.log('開始');
  task(); // 渡された関数を実行
  console.log('完了');
}

runWithLogging(() => {
  console.log('Firestore に保存中...');
});


// ─────────────────────────────────────────
// ⑥ ジェネリクス（Generics）— 型を「引数」にする
// ─────────────────────────────────────────

// <T> の T は「型の変数」。呼び出し時に具体的な型が決まる
// 「T 型の配列を受け取って、T 型の最初の要素を返す」
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// 呼び出す時に型が確定する
const firstString = first(['りんご', 'みかん', 'ぶどう']); // → string | undefined
const firstNumber = first([10, 20, 30]);                     // → number | undefined

// このアプリでよく出てくる: useState<T>() も同じ仕組み
// useState<string>('')  → state は string 型
// useState<number>(0)   → state は number 型
// useState<Event[]>([]) → state は Event[] 型


// ─────────────────────────────────────────
// ⑦ 実際のアプリで使われているパターン
// ─────────────────────────────────────────

type EventStatus = 'scheduled' | 'in_progress' | 'waiting' | 'ready' | 'completed' | 'cancelled';

// ステータスに対応する日本語ラベルを返す関数
// 引数と戻り値に明確な型がついている
function getStatusLabel(status: EventStatus): string {
  const labels: Record<EventStatus, string> = {
    scheduled:   '予定',
    in_progress: '準備中',
    waiting:     '入荷待ち',
    ready:       '準備完了',
    completed:   '完了',
    cancelled:   'キャンセル',
  };
  return labels[status];
}

// Record<K, V> は「K 型のキーで V 型の値を持つオブジェクト」
// Record<EventStatus, string> = EventStatus の全種類をキーに持つオブジェクト


// ─────────────────────────────────────────
// まとめ
// ─────────────────────────────────────────
// (a: number): string => { ... }  → 引数・戻り値の型注釈
// param?                          → 省略可能な引数
// param = defaultValue            → デフォルト値
// const fn = () => { ... }        → アロー関数（Reactでよく使う）
// onClick: () => void             → 関数型（引数なし・戻り値なし）
// <T>                             → ジェネリクス（型を変数にする）
// Record<K, V>                    → キーと値の型を指定したオブジェクト
