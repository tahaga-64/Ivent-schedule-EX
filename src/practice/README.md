# TypeScript 学習ノート

このフォルダは TypeScript の学習用ファイルをまとめています。
**このブランチ（practice）は main にはマージしません。**

---

## ファイル構成

| ファイル | 内容 |
|---|---|
| `01_types.ts` | string / number / boolean / ユニオン型 / リテラル型 などの基本 |
| `02_interface.ts` | interface・type によるオブジェクト型定義 |
| `03_functions.ts` | 関数の型注釈 / アロー関数 / ジェネリクス |
| `04_react_types.tsx` | React × TypeScript：Props / useState / useRef / イベント型 |
| `05_real_code_reading.ts` | このアプリの実際のコードを読んで理解する |

---

## 読む順番

1. `01_types.ts` — まず型の種類を理解する
2. `02_interface.ts` — オブジェクトの型定義を覚える
3. `03_functions.ts` — 関数の書き方を覚える
4. `04_react_types.tsx` — React 特有のパターンを学ぶ
5. `05_real_code_reading.ts` — 実際のアプリコードを読む練習

---

## TypeScript の読み方ヒント

```typescript
// 変数の型注釈
const name: string = 'Alice';
//          ↑ここが型

// 関数の型注釈
function greet(name: string): string { ... }
//                    ↑引数の型    ↑戻り値の型

// ジェネリクス（型の変数）
useState<string>('')
//       ↑ここに型を渡す

// オプショナル（?）
prop?: string  // あってもなくてもよい
obj?.method()  // null セーフアクセス

// Nullish Coalescing (??)
val ?? 'default'  // val が null/undefined なら 'default'
```
