# CLI Reference

English | [日本語](../ja/cli.md)

## Overview

This document describes how the dot-agents CLI behaves. Specifically, it covers:

- How to use each command (`init` / `sync` / `check` / `list`), their options, and the conditions under which they stop
- The files reflected into the repository that adopts dot-agents (hereafter, the target repository)
- The fields of the configuration file `.agents/dot-agents.json` placed in the target repository

The following topics are not covered here:

- The overall steps for setting up and updating dot-agents (see [README.md](../../README.md))
- The content and organization of the reflected rules (see [rules.md](./rules.md))

Read this document when a command does not behave as you expect, or when you want to understand how reflection works in detail.

> [!NOTE]
> The CLI currently supports only Japanese, so the command output quoted below is in Japanese.

## Commands

dot-agents has four commands, all of which are run at the root of the target repository.

| Command | What it does | Writes files |
| --- | --- | --- |
| `init` | Selects the modules to reflect and reflects them into the target repository for the first time | Yes |
| `sync` | Reflects the modules again, following the selection in the configuration file | Yes |
| `check` | Verifies that the reflected files have not been edited or deleted locally | No |
| `list` | Lists the modules that can be selected | No |

Run a command in the form `npx github:otTATto/dot-agents <command>`. In the examples below, `npx github:otTATto/dot-agents` is abbreviated as `dot-agents`.

Every command exits with code 0 on success, and with code 1 when it fails or finds a problem.

## init

`init` selects the modules to reflect and reflects them into the target repository for the first time. Modules can be selected either interactively or with arguments.

```sh
dot-agents init [--lang <names>] [--stack <names>] [--core-only] [--force]
```

| Option | Meaning |
| --- | --- |
| `--lang <names>` | The lang modules to reflect (comma-separated, e.g. `typescript,rust`) |
| `--stack <names>` | The stack modules to reflect (comma-separated, e.g. `web,vue,tailwind`) |
| `--core-only` | Reflects only core, without selecting any lang or stack (cannot be combined with `--lang` / `--stack`) |
| `--force` | Overwrites files in the target repository that have the same names as the reflected files |

### Selecting interactively

When you run `init` from a terminal without any options, you can choose lang and stack modules from a list. The CLI asks you to confirm your selection before reflecting it, and writes nothing if you cancel along the way.

Modules inferred from the contents of the target repository are checked from the start. They are inferred as follows:

| Module | Selected when |
| --- | --- |
| typescript | `package.json` or `tsconfig.json` exists |
| rust | A `Cargo.toml` exists anywhere in the repository (`.git`, `node_modules`, `target`, `dist`, and `build` are not searched) |
| vue / react / astro | A package with the same name is among the dependencies in `package.json` |
| tailwind | `tailwindcss` or `@tailwindcss/*` is among the dependencies |
| lucide | `lucide-*` or `@lucide/*` is among the dependencies |
| web | Any of vue, react, astro, next, svelte, or vite is among the dependencies |

Dependencies include all of `dependencies`, `devDependencies`, and `peerDependencies`.

### Selecting with arguments

When `--lang` and `--stack`, or `--core-only`, are given, `init` reflects the modules without asking any questions. Use this form when running from an LLM or from a script.

```sh
dot-agents init --lang typescript --stack web,vue,tailwind,lucide
```

When the session is not interactive (for example, when an LLM is running the command) and no options are given, `init` prints the module names that can be selected and stops.

### When init stops

If any of the following applies, `init` writes nothing and exits with code 1:

- The repository is already initialized (`.agents/dot-agents.json` exists). Use `sync` instead
- A module name that does not exist was specified
- The target repository has a file with the same name as a file to be reflected (can be overwritten with `--force`)
- There is a problem with the markers in AGENTS.md (see [Handling of AGENTS.md](#handling-of-agentsmd))

Checks that do not depend on the selection (whether the repository is already initialized) are performed before any questions are asked.

## sync

`sync` reflects the modules again, following the selection recorded in the configuration file. Use it to update to a newer version of dot-agents.

```sh
dot-agents sync [--force]
```

When reflecting, `sync` behaves as follows:

- Writes out the files of the selected modules, rewriting only those whose content has changed
- Deletes the files of modules that are no longer selected
- Rewrites only the part of AGENTS.md enclosed by the markers

### When sync stops

If any of the following applies, `sync` writes nothing and exits with code 1. Because everything is checked before anything is written, the repository is never left partially updated.

| Condition | With `--force` |
| --- | --- |
| The configuration file `.agents/dot-agents.json` is missing or broken | Still stops (run `init` first, or fix the configuration file) |
| A reflected file or the shared part of AGENTS.md has been edited directly | Discards the local changes and overwrites them |
| The target repository has a file with the same name as a file to be reflected | Overwrites it |
| AGENTS.md has no markers, or its markers are broken | Still stops (fix the markers) |

When local edits are detected, the usual approach is to bring the changes into `rules/` in dot-agents and reflect them as a new version. Use `--force` only when the local changes are no longer needed.

## check

`check` verifies that the reflected files have not been edited or deleted locally. It does not write any files.

```sh
dot-agents check
```

If any of the following is found, `check` prints the details and exits with code 1:

- A reflected file or the shared part of AGENTS.md has been edited directly
- A reflected file or AGENTS.md has been deleted
- There is a problem with the markers in AGENTS.md

If there are no problems, it prints a line such as `問題ありません（dot-agents v0.1.0）` ("No problems").

`check` also looks up the latest dot-agents tag with `git ls-remote`. If a version newer than the one recorded in the target repository exists, it prints a warning together with the command to update. If the latest version cannot be checked, for example because there is no network connection, it only prints a warning and does not change the exit code.

## list

`list` lists the modules that can be selected, grouped into core, lang, and stack.

```sh
dot-agents list [--json]
```

With `--json`, it outputs JSON in the following form. Use it to look up the available modules from an LLM or a script.

```json
{
  "version": "0.1.0",
  "core": [{ "id": "core/comment", "name": "comment", "title": "コメントに関するルールや考え方" }],
  "lang": [{ "id": "lang/typescript", "name": "typescript", "title": "TypeScript / JavaScript に関するルールや考え方" }],
  "stack": [{ "id": "stack/vue", "name": "vue", "title": "Vue に関するルールや考え方" }]
}
```

## Reflected files

`init` and `sync` reflect the following files into the target repository.

| File | Content | May it be edited locally? |
| --- | --- | --- |
| `.agents/rules/<module name>.md` | The rules of the selected module, with a comment at the top indicating that the file was synced | No |
| `.agents/dot-agents.json` | The selected modules and the hashes of the reflected files (see [Configuration file](#configuration-file)) | No |
| `AGENTS.md` | Instructions shared by every repository, placed between the markers | Only outside the markers |
| `CLAUDE.md` | A single line, `@AGENTS.md`, which makes Claude Code load AGENTS.md | dot-agents does not change it if it already exists |

If you edit a reflected file directly, the next `sync` and `check` will detect it.

### Handling of AGENTS.md

In AGENTS.md, dot-agents manages only the part enclosed by the following two marker lines, and never changes anything outside them.

```md
<!-- dot-agents:begin -->
<!-- dot-agents:end -->
```

If AGENTS.md does not exist, dot-agents creates it with the shared part and a heading `## このリポジトリについて` ("About this repository"). Write instructions specific to the target repository outside the markers, for example under this heading.

If AGENTS.md already exists without markers, insert the two lines above where you want the shared part to go, and run the command again. dot-agents does not guess where to insert it, so it does not write anything even with `--force`. Place exactly one begin marker followed by exactly one end marker.

### Handling of CLAUDE.md

If CLAUDE.md does not exist, dot-agents creates it with the single line `@AGENTS.md`. This line makes Claude Code load AGENTS.md.

If CLAUDE.md already exists, dot-agents does not change it. If it has no `@AGENTS.md` line, dot-agents prints a warning, and you can add the line yourself as needed.

## Configuration file

`.agents/dot-agents.json` records what has been reflected into the target repository. `init` creates it, `sync` updates it, and `check` reads it.

| Field | Content |
| --- | --- |
| `version` | The version of dot-agents last reflected |
| `modules` | The IDs of the selected lang and stack modules (such as `lang/typescript`; core is not included) |
| `files` | An object whose keys are the paths of the reflected files and whose values are the hashes of their content |
| `blocks` | The hash of the part of AGENTS.md enclosed by the markers |

Paths are written relative to the root of the target repository with `/` as the separator, so that the configuration file is the same regardless of the OS. Hashes are computed after normalizing line endings to LF, so a change to CRLF on Windows is not treated as an edit.

To change the selected modules, edit `modules` and run `sync`. The other fields are managed by dot-agents, so do not edit them by hand.
