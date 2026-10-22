# Astro に関するルールや考え方

## コンポーネント

- Astro コンポーネントの frontmatter（ビルド時に実行）と `<script>`（ブラウザで実行）の境界を意識する
- Astro コンポーネントのロジックは frontmatter に集め、テンプレート内の式は単純に保つ

## ライフサイクル

- `<script>` で登録したイベントリスナーやタイマーは、必要に応じて解除する

## 画像

- 画像は `astro:assets` の `<Image />` コンポーネントで表示する

## 公式ドキュメント

- 以下に関連する作業の前に、該当する公式ガイドを参照する
  - [ページ・動的ルーティング・ミドルウェア](https://docs.astro.build/en/guides/routing/)
  - [Astro コンポーネント](https://docs.astro.build/en/basics/astro-components/)
  - [Content Collections によるコンテンツ管理](https://docs.astro.build/en/guides/content-collections/)
  - [スタイリング・Tailwind CSS](https://docs.astro.build/en/guides/styling/)
- 上記以外は [公式ドキュメント](https://docs.astro.build) を参照する
