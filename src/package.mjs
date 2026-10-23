import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** dot-agents パッケージのルートディレクトリの絶対パス */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** dot-agents のリポジトリの URL */
export const REPOSITORY_URL = "https://github.com/otTATto/dot-agents";

/**
 * @function dot-agents 自身の package.json に書かれたバージョンを読む
 */
export const readPackageVersion = async () => {
  const text = await readFile(join(PACKAGE_ROOT, "package.json"), "utf8");
  return JSON.parse(text).version;
};
