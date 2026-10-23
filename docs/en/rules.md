# Rule Structure

English | [日本語](../ja/rules.md)

## Overview

This document describes how the rules reflected by dot-agents are organized. Specifically, it covers:

- How the rules are divided (core / lang / stack and the shared part of AGENTS.md), and the list of modules
- The file names in the repository that adopts dot-agents (hereafter, the target repository)
- The guidelines for writing rules, and the steps for adding or changing them

The following topics are not covered here:

- The text of each rule (see `rules/` and `agents-md/shared.md` at the repository root; they are written in Japanese)
- How to use the CLI (see [cli.md](./cli.md))

Read this document when you want to know which rules are reflected, or when you want to add or change rules.

## Rule categories

The rules of dot-agents are divided into a part that every target repository receives and parts that are selected according to the language or framework.

| Category | Location | Reflected into | How it is selected |
| --- | --- | --- | --- |
| Shared part of AGENTS.md | `agents-md/shared.md` | The part of `AGENTS.md` enclosed by the markers | Always included |
| core | `rules/core/` | `.agents/rules/` | Always included |
| lang | `rules/lang/` | `.agents/rules/` | Selected per language |
| stack | `rules/stack/` | `.agents/rules/` | Selected per framework or library |

The shared part of AGENTS.md contains short instructions that an LLM should always keep in mind, such as how to proceed with work and the principles of code style. It also tells the LLM to refer to `.agents/rules/`, so the detailed rules are read as needed.

Each rule file is called a module. The current modules are as follows:

| Category | Module | Content |
| --- | --- | --- |
| core | comment | What to check before writing a comment, and where information that does not belong in comments should go |
| core | documentation | How to structure and write documentation |
| core | git | How to write branches, commit messages, and PRs |
| core | naming | How to name variables and functions |
| core | readability | Principles of readability, such as function responsibilities and conditionals |
| core | review | How to write code review comments |
| lang | typescript | Types, functions, naming, and JSDoc in TypeScript / JavaScript |
| lang | rust | Naming and Rustdoc in Rust |
| stack | web | Markup for web frontends (semantic markup, alt attributes, and target size) |
| stack | tailwind | How to use Tailwind CSS |
| stack | lucide | How to use Lucide icons |
| stack | vue | Vue components and lifecycle |
| stack | react | React components and lifecycle |
| stack | astro | Astro components, lifecycle, images, and official documentation |

You can also check the latest list with `npx github:otTATto/dot-agents list`.

## File names in the target repository

lang and stack modules are placed directly under `.agents/rules/`, without their category folders.

| Location in dot-agents | Location in the target repository |
| --- | --- |
| `rules/core/comment.md` | `.agents/rules/comment.md` |
| `rules/lang/typescript.md` | `.agents/rules/typescript.md` |
| `rules/stack/vue.md` | `.agents/rules/vue.md` |

For this reason, module names must not overlap across categories. If they do, the CLI stops with an error.

The target repository may also place its own rules in `.agents/rules/`. As long as their names differ from the files reflected by dot-agents, dot-agents does not touch them.

## Guidelines for writing rules

Rules are written with principles in core and concrete practices in lang and stack. Because every repository receives core regardless of its language, mixing language-specific practices into core would make the LLM try to follow them even in unrelated repositories.

- Write only principles that do not depend on a language or framework in core (e.g. "Make types explicit and take advantage of the language's type system")
- Write the concrete practices for those principles in lang or stack (e.g. do not use `any` in TypeScript; release resources with `onUnmounted` in Vue)
- When core leaves concrete practices to another module, refer to it, for example as "follow `<language name>.md`"
- Use generic subjects such as orders and products in examples (do not lean toward the domain of a specific project)

lang and stack modules are organized under topic headings (components, lifecycle, naming, comments, and so on), so that it is clear where to add a new rule.

## Steps for adding or changing rules

Rules are added or changed in `rules/` and `agents-md/` in dot-agents, not in the target repository. Editing them directly in the target repository makes the next `sync` and `check` stop.

1. Open an issue describing the change and discuss the direction
2. Write the rule
   - To change an existing module, edit the corresponding file
   - To add a module, create `rules/<category>/<module name>.md`. Start the file with a heading beginning with `# ` (it becomes the description shown by `list`)
3. Reflect the change into dot-agents itself with `node bin/dot-agents.mjs sync`
4. If you added a module, add a row to [Rule categories](#rule-categories) in this document and in the Japanese version
5. Open a PR, merge it, and tag a release
6. Run `sync` in the target repository to pick up the new rules

A change to the rules affects how the LLM behaves in every target repository. For that reason, always gather changes in dot-agents and distribute them with a version.
