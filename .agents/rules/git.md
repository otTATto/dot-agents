<!-- dot-agents v0.1.0 から同期したファイルです。
     直接編集せず、https://github.com/otTATto/dot-agents を更新してください -->

# Git に関するルール

- 開発の段階や影響範囲によっては以下のルールを無視し、main に直接 commit & push する場合もあるが、必ずユーザの承認を得たうえで行うこと

## ブランチについて

- 大まかには main, feature/, fix/ の 3 種類のブランチから構成される
- 最新の main ブランチから作業ブランチ `feature/**` または `fix/**` を切って作業を開始する

## コミットメッセージについて

- 1行目に Commit Subject, 2行目に任意で Description を書く
- Commit Subject は Conventional Commits に準拠した形式を意識する
  - 本文は日本語
  - スコープは任意
  - 例: `feat(register): 利用規約への同意を必須にする`
- 差分ファイル名をそのままコミットメッセージに書くだけで満足せず、実装の背景にあるアルゴリズムやメンタルモデルを汲み取れるように上手く要約する
  - 悪い例: `fix: アカウントの新規登録ページを修正`
  - 良い例: `fix(register): 利用規約への同意を意味するチェックボックスをより目立たせた`
- 1行のコミットメッセージにまとめられない場合は、任意で Description を箇条書きで書く

## Pull Request について

- PR テンプレート `.github/PULL_REQUEST_TEMPLATE.md` がある場合は、それに沿って記述する
- `.github/labels.yml` がある場合は、そこで定義されるラベルを PR に付与することができる
- PR タイトルは `feat(register): アカウント登録画面の実装` のように、Conventional Commits に準拠した形式で書く
- レビュワーのレビュー負担軽減のため、1PR あたりのコード差分は原則 500 行以内とする
- 特に差分が 1,000 行を超える場合は、必ず複数の PR に分割する
- レビュワーがいる場合は、Approve されるまで main には merge しない
