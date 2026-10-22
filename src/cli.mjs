import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CATEGORIES, PACKAGE_ROOT, loadCatalog } from "./modules.mjs";

const USAGE = `dot-agents - LLM 向けルールをリポジトリに反映する CLI

使い方:
  dot-agents <command> [options]

コマンド:
  list [--json]   選択可能なルールモジュールを一覧表示する

オプション:
  -h, --help      このヘルプを表示する
  -v, --version   バージョンを表示する
`;

const CORE_LABEL = "（常に含まれる）";

const readVersion = async () => {
  const text = await readFile(join(PACKAGE_ROOT, "package.json"), "utf8");
  return JSON.parse(text).version;
};

const formatHumanList = (catalog) => {
  const lines = [];
  for (const category of CATEGORIES) {
    const label = category === "core" ? `${category}${CORE_LABEL}` : category;
    lines.push(label);
    const width = Math.max(...catalog[category].map((m) => m.name.length));
    for (const mod of catalog[category]) {
      lines.push(`  ${mod.name.padEnd(width)}  ${mod.title}`);
    }
  }
  return lines.join("\n");
};

const runList = async (args) => {
  const { values } = parseArgs({
    args,
    options: { json: { type: "boolean", default: false } },
    allowPositionals: false,
  });
  const catalog = await loadCatalog();

  if (!values.json) {
    console.log(formatHumanList(catalog));
    return 0;
  }

  const output = { version: await readVersion() };
  for (const category of CATEGORIES) {
    output[category] = catalog[category].map(({ id, name, title }) => ({
      id,
      name,
      title,
    }));
  }
  console.log(JSON.stringify(output, null, 2));
  return 0;
};

const COMMANDS = {
  list: runList,
};

/**
 * @function CLI を実行し、終了コードを返す
 *
 * @param argv サブコマンド以降の引数配列（process.argv.slice(2) 相当）
 * @returns プロセスの終了コード（正常時 0、未知のコマンドや不正なオプション時 1）
 *
 * NOTE:
 *   - 出力は標準出力、エラーと未知コマンド時の usage は標準エラーに書く
 *   - コマンド内で発生した予期しない例外は呼び出し元に伝播する
 */
export const run = async (argv) => {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    console.log(await readVersion());
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`未知のコマンドです: ${command}\n`);
    console.error(USAGE);
    return 1;
  }

  try {
    return await handler(rest);
  } catch (error) {
    if (error?.code?.startsWith("ERR_PARSE_ARGS_")) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
};
