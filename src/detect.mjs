import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const WEB_DEPENDENCIES = ["vue", "react", "astro", "next", "svelte", "vite"];

const IGNORED_DIRS = new Set([".git", "node_modules", "target", "dist", "build"]);

const hasFileBelow = async (dir, fileName) => {
  const entries = await readdir(dir, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === fileName)) {
    return true;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && (await hasFileBelow(join(dir, entry.name), fileName))) {
      return true;
    }
  }
  return false;
};

const readDependencyNames = async (cwd) => {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) {
    return null;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return [];
    }
    throw error;
  }
  return ["dependencies", "devDependencies", "peerDependencies"].flatMap((key) =>
    Object.keys(manifest?.[key] ?? {}),
  );
};

/**
 * @function 対象リポジトリの内容から、反映を提案する lang / stack のモジュール名を推定する
 *
 * @param cwd 対象リポジトリのルート
 * @returns { lang, stack }。それぞれ name 昇順のモジュール名の配列
 *   - lang/typescript: package.json または tsconfig.json がある
 *   - lang/rust      : リポジトリ内のどこかに Cargo.toml がある（.git・node_modules・ビルド出力のフォルダは探さない）
 *   - stack/*        : package.json の依存（dependencies / devDependencies / peerDependencies）から推定する
 *
 * NOTE:
 *   - 推定は補助なので、package.json が JSON として不正な場合は依存なしとして扱い、エラーにしない
 *   - それ以外の読み込みエラーは呼び出し元に伝播する
 *   - カタログに存在するかは確認しない
 */
export const detectModules = async (cwd) => {
  const dependencies = await readDependencyNames(cwd);
  const hasDependency = (matches) =>
    (dependencies ?? []).some((name) => matches(name));
  const hasExact = (target) => hasDependency((name) => name === target);

  const lang = [];
  if (dependencies !== null || existsSync(join(cwd, "tsconfig.json"))) {
    lang.push("typescript");
  }
  if (await hasFileBelow(cwd, "Cargo.toml")) {
    lang.push("rust");
  }

  const stackDetectors = {
    vue: () => hasExact("vue"),
    react: () => hasExact("react"),
    astro: () => hasExact("astro"),
    tailwind: () => hasDependency((name) => name === "tailwindcss" || name.startsWith("@tailwindcss/")),
    lucide: () => hasDependency((name) => name.startsWith("lucide-") || name.startsWith("@lucide/")),
    web: () => WEB_DEPENDENCIES.some(hasExact),
  };
  const stack = Object.keys(stackDetectors).filter((name) => stackDetectors[name]());

  return { lang: lang.sort(), stack: stack.sort() };
};
