// =============================================================
// 04_react_types.tsx — React × TypeScript の基本パターン
// このアプリ（Ivent-schedule-EX）の実装に直結する内容です
// ※ .tsx 拡張子 = TypeScript + JSX（React の HTML 風構文）が書けるファイル
// =============================================================

import { useState, useRef, useEffect } from 'react';


// ─────────────────────────────────────────
// ① Props の型定義
// ─────────────────────────────────────────

// コンポーネントが受け取る引数を「Props」と呼ぶ
// interface または type で定義する

interface CardProps {
  title: string;         // 必須の文字列
  subtitle?: string;     // 省略可能
  count: number;         // 必須の数値
  onClick: () => void;   // クリック時に呼ばれる関数（引数なし・戻り値なし）
}

// Props を受け取るコンポーネント
// ({ title, count, onClick }: CardProps) は「分割代入 + 型注釈」
function EventCard({ title, subtitle, count, onClick }: CardProps) {
  return (
    <div onClick={onClick}>
      <h2>{title}</h2>
      {/* subtitle? → undefined のときは何も表示しない（短絡評価） */}
      {subtitle && <p>{subtitle}</p>}
      <span>{count}</span>
    </div>
  );
}


// ─────────────────────────────────────────
// ② useState の型
// ─────────────────────────────────────────

function Counter() {
  // useState<number>(0)
  //   → state の型: number
  //   → 初期値: 0
  //   → count は number 型、setCount は (n: number) => void 型
  const [count, setCount] = useState<number>(0);

  // useState<string>('')
  //   → state の型: string
  const [name, setName] = useState<string>('');

  // useState<string | null>(null)
  //   → 初期値は null、あとから string を入れることもある
  //   → 「まだ何も選ばれていない」状態を null で表す
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // useState<boolean>(false)
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // 型推論が効く場合は <型> を省略できる
  // useState(0) → number と推論される
  const [autoTyped, setAutoTyped] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
    </div>
  );
}


// ─────────────────────────────────────────
// ③ useRef の型
// ─────────────────────────────────────────

function TimerExample() {
  // useRef<number | null>(null)
  //   → DOM要素ではなく「値を保持する」用途
  //   → 再レンダーしても値が消えない変数（state と違いレンダーは起こさない）
  const intervalRef = useRef<number | null>(null);

  // useRef<HTMLDivElement>(null)
  //   → DOM要素への参照
  //   → HTML の div 要素を指す
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // current プロパティで実際の値/要素にアクセス
    intervalRef.current = window.setInterval(() => {
      console.log('tick');
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return <div ref={containerRef}>タイマー</div>;
}


// ─────────────────────────────────────────
// ④ イベントハンドラの型
// ─────────────────────────────────────────

function FormExample() {
  const [value, setValue] = useState('');

  // React.ChangeEvent<HTMLInputElement>
  //   → input 要素の onChange に渡されるイベントオブジェクトの型
  //   → e.target.value で入力値を取得できる
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  // React.FormEvent<HTMLFormElement>
  //   → form の onSubmit に渡されるイベントの型
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // デフォルトのページリロードを防ぐ
    console.log('送信:', value);
  };

  // React.MouseEvent<HTMLButtonElement>
  //   → button の onClick に渡されるイベントの型
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('クリック位置:', e.clientX, e.clientY);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={value} onChange={handleChange} />
      <button type="submit" onClick={handleClick}>送信</button>
    </form>
  );
}


// ─────────────────────────────────────────
// ⑤ children の型
// ─────────────────────────────────────────

// React.ReactNode : JSX・文字列・数値・null など「React が表示できるもの」全て
interface LayoutProps {
  children: React.ReactNode;  // <Layout>ここの内容</Layout> が children
  className?: string;
}

function Layout({ children, className }: LayoutProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

// 使用例
// <Layout className="p-4">
//   <p>ここが children になる</p>
// </Layout>


// ─────────────────────────────────────────
// ⑥ 型アサーション（as）
// ─────────────────────────────────────────

// TypeScript が型を特定できない場面で「これはこの型だ」と教える
// 使いすぎると危険だが、DOM 操作や外部データ処理で必要になることがある

const element = document.getElementById('root') as HTMLDivElement;
//                                               ↑
//                   getElementById の戻り値は HTMLElement | null だが
//                   「これは HTMLDivElement だ」と明示する

// ! （非nullアサーション）: 「絶対に null/undefined ではない」と断言
const button = document.querySelector('button')!;
//                                              ↑
//              querySelector は null を返す可能性があるが
//              「ここでは必ず存在する」と断言する（自己責任）


// ─────────────────────────────────────────
// まとめ
// ─────────────────────────────────────────
// interface Props { ... }             → コンポーネントの引数定義
// function Comp({ a, b }: Props)      → 分割代入 + 型注釈
// useState<Type>(初期値)              → state の型
// useRef<Type>(初期値)                → ref の型（DOM or 値保持）
// React.ChangeEvent<HTMLInputElement> → input の onChange イベント型
// React.FormEvent<HTMLFormElement>    → form の onSubmit イベント型
// React.ReactNode                     → children に使う型
// value as Type                       → 型アサーション
// value!                              → 非 null アサーション
