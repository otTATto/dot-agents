import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** パッケージのルートディレクトリの絶対パス */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** rules/ ディレクトリの絶対パス */
export const RULES_DIR = join(PACKAGE_ROOT, "rules");

/** モジュールのカテゴリ */
export const CATEGORIES = ["core", "lang", "stack"];

/**
 * @function dot-agents 自身の package.json に書かれたバージョンを読む
 */
export const readPackageVersion = async () => {
  const text = await readFile(join(PACKAGE_ROOT, "package.json"), "utf8");
  return JSON.parse(text).version;
};

const HEADING_PATTERN = /^# (.+)$/m;

const readTitle = async (path) => {
  const text = await readFile(path, "utf8");
  const match = HEADING_PATTERN.exec(text);
  if (!match) {
    throw new Error(`見出し（# ...）が見つかりません: ${path}`);
  }
  return match[1].trim();
};

const loadCategory = async (category) => {
  const dir = join(RULES_DIR, category);
  const entries = await readdir(dir, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -".md".length))
    .sort();

  return Promise.all(
    names.map(async (name) => {
      const path = join(dir, `${name}.md`);
      return {
        id: `${category}/${name}`,
        category,
        name,
        title: await readTitle(path),
        path,
      };
    }),
  );
};

/**
 * @function カテゴリをまたいで name が重複するモジュールがないことを検証する
 *
 * @param catalog loadCatalog() が返すカタログ
 * @throws 重複する name がある場合（.agents/rules/ に平坦化すると衝突するため）
 */
export const assertUniqueNames = (catalog) => {
  const seen = new Map();
  for (const mod of Object.values(catalog).flat()) {
    const other = seen.get(mod.name);
    if (other) {
      throw new Error(`モジュール名が重複しています: ${other.id} と ${mod.id}`);
    }
    seen.set(mod.name, mod);
  }
};

/**
 * @function rules/ を走査してモジュールのカタログを作る
 *
 * @returns カテゴリ（core / lang / stack）をキー、name 昇順のモジュール配列を値とするオブジェクト
 *          各モジュールは { id, category, name, title, path }（path はソースの絶対パス）
 *
 * @throws rules/ またはカテゴリのディレクトリが存在しない場合、
 *         Markdown に level-1 見出しがない場合、モジュール名がカテゴリをまたいで重複する場合
 */
export const loadCatalog = async () => {
  if (!existsSync(RULES_DIR)) {
    throw new Error(`rules/ ディレクトリが見つかりません: ${RULES_DIR}`);
  }

  const catalog = {};
  for (const category of CATEGORIES) {
    catalog[category] = await loadCategory(category);
  }
  assertUniqueNames(catalog);
  return catalog;
};
