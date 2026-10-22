# Rust に関するルールや考え方

## 命名

- Rust の標準的な命名規約に従う
  - 型・トレイト・enum のバリアントは UpperCamelCase
  - 関数・メソッド・変数・モジュールは snake_case
  - 定数（`const`）と `static` は SCREAMING_SNAKE_CASE

## コメント

- ドキュメントコメントは `///` で記述する（`/** */` は使わない）
- `@param` / `@returns` は使わない（JSDoc 記法は Rustdoc に認識されない）
- `# Section` 見出しを使う。`cargo doc` でレンダリングされる
- よく使うセクション:
  - `# Parameters` — 引数の説明
  - `# Returns` — 返り値の説明
  - `# Errors` — `Result::Err` になる条件
  - `# Panics` — パニックする条件
  - `# Behavior` — 動作の詳細・注意事項
  - `# Examples` — 使用例（`cargo test` で実行される）

### 関数定義の例

```rust
/// 商品 ID と数量の一覧から、注文の小計を計算して返す
///
/// # Parameters
/// * `items` - 商品 ID と購入数量の組の一覧
/// * `catalog` - 商品 ID から単価を引くための商品カタログ
///
/// # Errors
/// * `items` に `catalog` にない商品 ID が含まれる場合は `OrderError::UnknownProduct` を返す
///
/// # Behavior
/// * 数量が 0 の商品は計算から除外する
fn calculate_subtotal(
    items: &[(ProductId, u32)],
    catalog: &HashMap<ProductId, u64>,
) -> Result<u64, OrderError> {
    ...
}
```
