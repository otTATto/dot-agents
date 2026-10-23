# dot-agents

English | [日本語](./README.ja.md)

dot-agents is a CLI that reflects [otTATto](https://github.com/otTATto)'s **PERSONAL** rules and skills for LLM coding agents into any repository, and the repository that manages the source of those rules and skills.

> [!IMPORTANT]
> Currently, all rules and skills are written **ONLY in Japanese**, and the CLI supports **ONLY Japanese**.

## 📜 Usage

> [!NOTE]
> Node.js (v22 or later) and git are required.

> [!TIP]
> To learn more about each CLI command, run `npx github:otTATto/dot-agents --help` or see 📖 [docs/ja/cli.md](./docs/ja/cli.md) (Japanese).

### 🔰 Setting up dot-agents in a repository for the first time

1. Run the following at the root of the repository
   ```sh
   npx github:otTATto/dot-agents init
   ```
2. Select the languages and frameworks that match the repository
   ```sh
   *  lang を選んでください（スペースで選択、Enter で確定）
   |  [+] rust (Rust に関するルールや考え方)
   |  [+] typescript (TypeScript / JavaScript に関するルールや考え方)
   ```
3. Review the summary and select Yes
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
4. `AGENTS.md`, `CLAUDE.md`, and `.agents/` are created in the repository

> [!TIP]
> For details on the generated rules, see 📖 [docs/ja/rules.md](./docs/ja/rules.md) (Japanese).

### 🪄 Updating a repository that already uses dot-agents to the latest version

1. Run the following at the root of the repository
   ```sh
   npx github:otTATto/dot-agents sync
   ```
2. Review the updated files and commit them

> [!TIP]
> To pin a specific version, specify a tag, such as `npx github:otTATto/dot-agents#v0.1.0 sync`.

## 🗺️ Roadmap

In the table below, `✅` means done, `🚧` means in progress, and `N/A` means not started.

| | v | Description | Rules | Skills | Via GitHub | Via npm |
| :-- | --: | :-- | :--: | :--: | :--: | :-- |
| 🚧 | v0.1.0 | Experimental implementation | ✅ | N/A | ✅ | N/A |
| N/A | v1.0.0 | Rollout to personal repositories | ✅ | N/A | ✅ | N/A |

## 💻 Tech Stack

| Item | Details |
| -- | -- |
| Language | JavaScript (ES Modules) |
| Runtime | Node.js 22 or later |
| Dependencies | [@clack/prompts](https://github.com/bombshell-dev/clack) |
| Testing | `node:test` |

## 🗂️ Repository Structure

```
dot-agents/
├── bin/          # CLI entry point
├── src/          # CLI implementation
├── test/         # CLI tests
├── rules/        # Source of the rules to reflect
│   ├── core/     # Rules included in every repository
│   ├── lang/     # Rules for each language
│   └── stack/    # Rules for each framework or library
├── agents-md/    # Source of the shared part of AGENTS.md
├── .agents/      # Rules reflected into dot-agents itself (do not edit directly)
├── AGENTS.md
└── CLAUDE.md
```

## 🤝 Contributing

### 1. Setting up the development environment

1. Clone the repository and install the dependencies
   ```sh
   git clone https://github.com/otTATto/dot-agents.git
   cd dot-agents
   npm install
   ```
2. The Node.js version is pinned to 22 in `.node-version`
3. Make sure the tests pass with `npm test`

### 2. Development workflow

1. Open an issue describing the change and discuss the direction with [otTATto](https://github.com/otTATto)
2. Create a `feature/**` or `fix/**` branch from the latest `main` branch and develop on it
   - After changing `rules/` or `agents-md/`, reflect the changes into dot-agents itself with `node bin/dot-agents.mjs sync`
   - When trying out the CLI, run it in a temporary directory; run `init` or `sync` in this repository only to reflect changes into dot-agents itself
3. Open a PR, and once [otTATto](https://github.com/otTATto) approves it, merge it into the main branch
4. [otTATto](https://github.com/otTATto) tags and releases a new version at an appropriate time
5. The new version becomes available to any repository
