import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashContent, normalizeNewlines, readTextIfExists } from "./config.mjs";
import { PACKAGE_ROOT } from "./package.mjs";

/** AGENTS.md の共通部分（dot-agents に同梱）の絶対パス */
export const SHARED_AGENTS_MD_PATH = join(PACKAGE_ROOT, "agents-md", "shared.md");

/** 対象リポジトリのルートから見た AGENTS.md のパス */
export const AGENTS_MD_PATH = "AGENTS.md";

/** 対象リポジトリのルートから見た CLAUDE.md のパス */
export const CLAUDE_MD_PATH = "CLAUDE.md";

/** AGENTS.md の管理ブロックの開始マーカー */
export const BEGIN_MARKER = "<!-- dot-agents:begin -->";

/** AGENTS.md の管理ブロックの終了マーカー */
export const END_MARKER = "<!-- dot-agents:end -->";

const CLAUDE_MD_IMPORT = "@AGENTS.md";

const countOccurrences = (text, search) => text.split(search).length - 1;

const buildMissingMarkersProblem = () =>
  [
    `${AGENTS_MD_PATH} に dot-agents のマーカーがありません。`,
    "共通ルールを入れたい位置に、次の 2 行を挿入してください。",
    `  ${BEGIN_MARKER}`,
    `  ${END_MARKER}`,
    "共通ルールと重複する既存の内容は、移動または削除してください。",
  ].join("\n");

const buildMalformedMarkersProblem = (beginCount, endCount) =>
  `${AGENTS_MD_PATH} のマーカーが不正です（${BEGIN_MARKER} が ${beginCount} 個、${END_MARKER} が ${endCount} 個）。開始と終了をこの順に 1 つずつ配置してください。`;

/**
 * @function 共通部分から AGENTS.md の管理ブロック（開始マーカーから終了マーカーまで）を作る
 *
 * @param shared agents-md/shared.md の中身
 * @returns LF 改行の管理ブロック
 */
export const buildAgentsMdBlock = (shared) =>
  `${BEGIN_MARKER}\n\n${normalizeNewlines(shared).trimEnd()}\n\n${END_MARKER}`;

/**
 * @function 現在の AGENTS.md の中身に管理ブロックを反映した新しい中身を作る
 *
 * @param current 現在の AGENTS.md の中身（LF 正規化済み）。存在しない場合は null
 * @param block buildAgentsMdBlock() が返す管理ブロック
 * @returns 反映できる場合は { text, currentBlock }。
 *          マーカーに問題がある場合は { problem }（ユーザー向けのメッセージ）
 *
 * NOTE:
 *   - current が null の場合は、見出し付きの新規ファイルの中身を返す（currentBlock は null）
 *   - 開始・終了マーカーがちょうど 1 つずつこの順にある場合のみ、ブロックを置き換える
 *   - ブロックの外側は一切変更しない
 *   - マーカーがない場合は挿入位置を推測せず、problem を返す
 */
export const mergeAgentsMd = (current, block) => {
  if (current === null) {
    return {
      text: `# プロジェクト全体のルール\n\n${block}\n\n## このリポジトリについて\n`,
      currentBlock: null,
    };
  }

  const beginCount = countOccurrences(current, BEGIN_MARKER);
  const endCount = countOccurrences(current, END_MARKER);
  if (beginCount === 0 && endCount === 0) {
    return { problem: buildMissingMarkersProblem() };
  }

  const begin = current.indexOf(BEGIN_MARKER);
  const end = current.indexOf(END_MARKER);
  if (beginCount !== 1 || endCount !== 1 || end < begin) {
    return { problem: buildMalformedMarkersProblem(beginCount, endCount) };
  }

  const blockEnd = end + END_MARKER.length;
  return {
    text: `${current.slice(0, begin)}${block}${current.slice(blockEnd)}`,
    currentBlock: current.slice(begin, blockEnd),
  };
};

/**
 * @function CLAUDE.md の中身が AGENTS.md を取り込む行（@AGENTS.md）を持つか判定する
 *
 * @param text CLAUDE.md の中身
 */
export const hasAgentsMdImport = (text) =>
  normalizeNewlines(text)
    .split("\n")
    .some((line) => line.trim() === CLAUDE_MD_IMPORT);

/**
 * @function AGENTS.md に反映する内容を計画する（何も書き込まない）
 *
 * @param options.cwd 対象リポジトリのルート
 * @param options.recordedBlockHash 設定ファイルに記録済みの管理ブロックのハッシュ。無ければ undefined
 * @returns マーカーに問題がある場合は { problem }。
 *          それ以外は { current, text, blockHash, isBlockEdited }
 *   - current: 現在の中身。存在しない場合は null
 *   - text: 反映後の中身
 *   - blockHash: 反映後の管理ブロックのハッシュ（設定ファイルの blocks に記録する）
 *   - isBlockEdited: 記録済みのハッシュと現在の管理ブロックが異なるか
 */
export const planAgentsMd = async ({ cwd, recordedBlockHash }) => {
  const current = await readTextIfExists(join(cwd, AGENTS_MD_PATH));
  const block = buildAgentsMdBlock(await readFile(SHARED_AGENTS_MD_PATH, "utf8"));
  const merged = mergeAgentsMd(current, block);
  if (merged.problem) {
    return { problem: merged.problem };
  }

  const isBlockEdited =
    merged.currentBlock !== null &&
    recordedBlockHash !== undefined &&
    hashContent(merged.currentBlock) !== recordedBlockHash;
  return { current, text: merged.text, blockHash: hashContent(block), isBlockEdited };
};

/**
 * @function planAgentsMd() の計画に従って AGENTS.md を書き込む
 *
 * @returns 新規作成なら "added"、内容が変わったなら "updated"、変わらなければ "unchanged"（書き込まない）
 */
export const writeAgentsMd = async (cwd, { current, text }) => {
  if (current === text) {
    return "unchanged";
  }
  await writeFile(join(cwd, AGENTS_MD_PATH), text);
  return current === null ? "added" : "updated";
};

/**
 * @function CLAUDE.md が無ければ AGENTS.md を取り込む内容で作る
 *
 * @returns { created, warning }
 *   - created: 新規作成したか
 *   - warning: 既存の CLAUDE.md に @AGENTS.md の行がない場合のメッセージ。それ以外は null
 *
 * NOTE: 既存の CLAUDE.md は変更しない
 */
export const ensureClaudeMd = async (cwd) => {
  const path = join(cwd, CLAUDE_MD_PATH);
  const current = await readTextIfExists(path);
  if (current === null) {
    await writeFile(path, `${CLAUDE_MD_IMPORT}\n`);
    return { created: true, warning: null };
  }
  if (hasAgentsMdImport(current)) {
    return { created: false, warning: null };
  }
  return {
    created: false,
    warning: `${CLAUDE_MD_PATH} に ${CLAUDE_MD_IMPORT} の行がありません。Claude Code に ${AGENTS_MD_PATH} を読み込ませるには、${CLAUDE_MD_PATH} に ${CLAUDE_MD_IMPORT} を追加してください。`,
  };
};
