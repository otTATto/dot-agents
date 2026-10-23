import { readFile } from "node:fs/promises";
import { normalizeNewlines } from "./config.mjs";
import { REPOSITORY_URL } from "./package.mjs";

/** 対象リポジトリのルートから見たルールの配置先 */
export const RULES_TARGET_DIR = ".agents/rules";

const buildHeader = (version) =>
  [
    `<!-- dot-agents v${version} から同期したファイルです。`,
    `     直接編集せず、${REPOSITORY_URL} を更新してください -->`,
  ].join("\n");

/**
 * @function ルールのモジュールから、対象リポジトリに書き出すファイルとその中身を作る
 *
 * @param modules 反映するモジュール（カタログのモジュール形式）
 * @param version 同期時の dot-agents のバージョン（ヘッダーに記載する）
 * @returns 対象リポジトリのルートからの相対パス（/ 区切り）をキー、LF 改行の中身を値とする Map
 */
export const buildRuleFiles = async (modules, version) => {
  const header = buildHeader(version);
  const files = new Map();
  for (const mod of modules) {
    const source = normalizeNewlines(await readFile(mod.path, "utf8"));
    files.set(`${RULES_TARGET_DIR}/${mod.name}.md`, `${header}\n\n${source}`);
  }
  return files;
};
