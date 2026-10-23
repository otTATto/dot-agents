# dot-agents

[English](./README.md) | 日本語

dot-agents は、[otTATto](https://github.com/otTATto) の**個人的な** LLM 向けのルールやスキルを任意のリポジトリに反映する CLI と、それらルール・スキルの本文を管理するリポジトリです。

> [!IMPORTANT]
> 現在、ルールやスキルはすべて**日本語のみ**で書かれており、CLI も**日本語のみ**に対応しています。

## 📜 使い方

> [!NOTE]
> Node.js（v22 以上）と git が必要です。

> [!TIP]
> 各 CLI コマンドの詳しい使い方を知りたいときは `npx github:otTATto/dot-agents --help` を実行するか、📖 [docs/ja/cli.md](./docs/ja/cli.md) を参照してください。

### 🔰 そのリポジトリにはじめて導入する場合

1. 任意のリポジトリのルートで、以下を実行する
   ```sh
   npx github:otTATto/dot-agents init
   ```
2. リポジトリに合わせて言語やフレームワークを選択する
   ```sh
   *  lang を選んでください（スペースで選択、Enter で確定）
   |  [+] rust (Rust に関するルールや考え方)
   |  [+] typescript (TypeScript / JavaScript に関するルールや考え方)
   ```
3. 確認して Yes を選択する
   ```sh
   o  反映する内容 --------------+
   |                             |
   |  core（常に含まれる）       |
   |  lang: typescript           |
   |  stack: tailwind, web, vue  |
   |                             |
   +-----------------------------+
   |
   o  この内容で反映しますか？
      Yes
   ```
4. リポジトリに `AGENTS.md`, `CLAUDE.md`, `.agents/` が作成される

> [!TIP]
> 作成されるルールの詳細については、📖 [docs/ja/rules.md](./docs/ja/rules.md) を参照してください。

### 🪄 導入済みのリポジトリで最新の dot-agents に更新する場合

1. 導入済みのリポジトリのルートで、以下を実行する
   ```sh
   npx github:otTATto/dot-agents sync
   ```
2. 更新されたファイルを確認してコミットする

> [!TIP]
> 特定のバージョンに揃えたい場合は、`npx github:otTATto/dot-agents#v0.1.0 sync` のようにタグを指定します。

## 🗺️ ロードマップ

以下の表では、`✅`: 完了、`🚧`: 途中、`N/A`: 未着手を意味しています。

| | v | 内容 | ルール | スキル | GitHub 経由の反映 | npm 経由の反映 |
| :-- | --: | :-- | :--: | :--: | :--: | :-- |
| 🚧 | v0.1.0 | 試験的な実装 | ✅ | N/A | ✅ | N/A |
| N/A | v1.0.0 | 個人のリポジトリへの展開 | ✅ | N/A | ✅ | N/A |

## 💻 技術スタック

| 項目 | 内容 |
| -- | -- |
| 言語 | JavaScript（ES Modules） |
| 実行環境 | Node.js 22 以上 |
| 依存パッケージ | [@clack/prompts](https://github.com/bombshell-dev/clack) |
| テスト | `node:test` |

## 🗂️ リポジトリ構造

```
dot-agents/
├── bin/          # CLI の入口
├── src/          # CLI の実装
├── test/         # CLI のテスト
├── rules/        # 反映するルールの本文
│   ├── core/     # すべてのリポジトリに入るルール
│   ├── lang/     # 言語ごとのルール
│   └── stack/    # フレームワークやライブラリごとのルール
├── agents-md/    # AGENTS.md の共通部分の本文
├── .agents/      # dot-agents 自身に反映したルール（直接編集しない）
├── AGENTS.md
└── CLAUDE.md
```

## 🤝 Contributing

### 1. 開発環境の構築

1. リポジトリを clone して、依存パッケージをインストールします
   ```sh
   git clone https://github.com/otTATto/dot-agents.git
   cd dot-agents
   npm install
   ```
2. Node.js のバージョンは `.node-version` で 22 に固定しています
3. `npm test` でテストが通ることを確認します

### 2. 開発の手順

1. 変更したい内容を issue に立てて、[otTATto](https://github.com/otTATto) と方針を相談します
2. 最新の `main` ブランチから `feature/**` または `fix/**` のブランチを切って開発します
   - `rules/` や `agents-md/` を変更したら、`node bin/dot-agents.mjs sync` で dot-agents 自身にも反映します
   - CLI を試すときは一時フォルダで実行し、このリポジトリで `init` や `sync` を実行するのは自身に反映するときだけにします
3. PR を出して [otTATto](https://github.com/otTATto) に Approve されたら、main ブランチに merge します
4. [otTATto](https://github.com/otTATto) が程よいタイミングでタグを付けてリリースします
5. 任意のリポジトリで新しいバージョンが使えるようになります
