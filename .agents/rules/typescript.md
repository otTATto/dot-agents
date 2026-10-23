<!-- dot-agents v0.1.0 から同期したファイルです。
     直接編集せず、https://github.com/otTATto/dot-agents を更新してください -->

# TypeScript / JavaScript に関するルールや考え方

TypeScript と JavaScript のコードに適用する。型に関する項目は TypeScript のみが対象。

## 型

- 厳密な型づけを意識する（基本的に `any` は使わない）
- `as` による危険な型アサーションを避ける
- `null` / `undefined` の扱いを明示する

## 関数

- 原則としてアロー関数を使用する（`const fn = () => {}`）
  - function 宣言は、明確な理由がある場合にのみ使用する
  - コンポーネントの書き方など、FW ごとの例外は各スタックのルールに従う

## 命名

- 定数は UPPER_SNAKE_CASE で記述する
  - Object や Map であっても、定数に該当する場合は UPPER_SNAKE_CASE とする
  - フレームワークで予約されている変数名（Next.js の `metadata` 等）には適用しない
- DB 上の型とアプリ側の型が異なる場合は、それらに共通する型を `**Base` として定義し、それを継承する形で `**`(無印): アプリ側, `**DB`: DB 側の型を定義する

## コメント

- 関数や型のドキュメントコメントは JSDoc スタイルで書く

### 型定義の例

```typescript
// src/types/user.ts

/**
 * 配送先住所
 *
 * - id           : 住所の一意識別子
 * - postalCode   : 郵便番号
 * - fullAddress  : 住所
 * - recipientName: 受取人名
 * - isDefault    : デフォルト住所かどうか
 */
export type Address = {
  id: string;
  postalCode: string;
  fullAddress: string;
  recipientName: string;
  isDefault: boolean;
};
```

### 関数定義の例

```typescript
/**
 * @function 商品 ID と数量を受け取り、商品名や単価、小計を付け加えた形に整形して返す
 *
 * @param items 商品 ID をキー、購入数量を値とする Record
 * @returns 商品 ID をキーとし、商品名・単価・数量・小計を持つ Record
 *
 * NOTE:
 *   - 商品情報の取得に失敗した場合は null を返す
 *   - 入力された商品 ID のうち PRODUCT_IDS に合致するもののみ返す
 *   - つまり、返り値のキーに引数のキーすべてが存在するとは限らない
 *
 * e.g.
 *   - @param items { 'book': 2, 'pen': 3, 'unknownItem': 1 }
 *     ↓
 *     @returns {
 *       'book': { name: 'ノート', unitPrice: 300, quantity: 2, subtotal: 600 },
 *       'pen': { name: 'ペン', unitPrice: 120, quantity: 3, subtotal: 360 }
 *     }
 */
export const formatOrderItems = async (
  items: Partial<Record<ProductId, number>>,
): Promise<Partial<OrderItems> | null> => {
  ...
};
```
