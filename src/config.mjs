import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** 対象リポジトリのルートから見た設定ファイルのパス */
export const CONFIG_PATH = ".agents/dot-agents.json";

/** ユーザーが対処すべき設定ファイルの不備を表すエラー */
export class ConfigError extends Error {}

/**
 * @function CRLF を LF に正規化する
 */
export const normalizeNewlines = (text) => text.replaceAll("\r\n", "\n");

/**
 * @function 改行を LF に正規化したうえで sha256 を計算する
 *
 * @returns "sha256:<hex>" 形式の文字列
 */
export const hashContent = (text) =>
  `sha256:${createHash("sha256").update(normalizeNewlines(text)).digest("hex")}`;

/**
 * @function ファイルを LF 正規化して読み込む
 *
 * @param path ファイルの絶対パス
 * @returns 中身。ファイルが存在しない場合は null
 */
export const readTextIfExists = async (path) => {
  if (!existsSync(path)) {
    return null;
  }
  return normalizeNewlines(await readFile(path, "utf8"));
};

const assertConfigShape = (config) => {
  const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isObject(config)) {
    throw new ConfigError(`${CONFIG_PATH} の形式が不正です（オブジェクトではありません）`);
  }
  if (!Array.isArray(config.modules) || !config.modules.every((id) => typeof id === "string")) {
    throw new ConfigError(`${CONFIG_PATH} の modules は文字列の配列にしてください`);
  }
  if (!isObject(config.files)) {
    throw new ConfigError(`${CONFIG_PATH} の files はオブジェクトにしてください`);
  }
  if (config.blocks !== undefined && !isObject(config.blocks)) {
    throw new ConfigError(`${CONFIG_PATH} の blocks はオブジェクトにしてください`);
  }
};

/**
 * @function 対象リポジトリの設定ファイルを読み込む
 *
 * @param cwd 対象リポジトリのルート
 * @returns 設定オブジェクト。ファイルが存在しない場合は null
 *   - version: 最後に反映した dot-agents のバージョン
 *   - modules: 選択した core 以外のモジュール ID の配列
 *   - files  : 反映したファイルのパスをキー、ハッシュを値とするオブジェクト
 *              パスは OS によらず同じ設定ファイルになるよう、ルートからの相対パスを / 区切りで書く
 *   - blocks : 管理ブロックを持つファイルのパスをキー、ブロック部分のハッシュを値とするオブジェクト
 *              キーの形式は files と同じ。書かれていない場合は {} として扱う
 * @throws {ConfigError} JSON として不正、または形式が不正な場合
 */
export const readConfig = async (cwd) => {
  const path = join(cwd, CONFIG_PATH);
  if (!existsSync(path)) {
    return null;
  }

  let config;
  try {
    config = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(`${CONFIG_PATH} を JSON として読み込めません: ${error.message}`);
    }
    throw error;
  }
  assertConfigShape(config);
  return { ...config, blocks: config.blocks ?? {} };
};

/**
 * @function 設定ファイルを整形した JSON（インデント 2、末尾改行）で書き出す
 */
export const writeConfig = async (cwd, config) => {
  const path = join(cwd, CONFIG_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
};
