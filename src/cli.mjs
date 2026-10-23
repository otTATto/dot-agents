import { parseArgs } from "node:util";
import { findLocalProblems } from "./check.mjs";
import { CONFIG_PATH, ConfigError, readConfig } from "./config.mjs";
import { detectModules } from "./detect.mjs";
import { CATEGORIES, SELECTABLE_CATEGORIES, loadCatalog } from "./modules.mjs";
import { readPackageVersion } from "./package.mjs";
import { promptSelection as defaultPromptSelection } from "./prompt.mjs";
import { reflectDotAgents } from "./reflect.mjs";
import { compareVersions, findLatestVersion, listRemoteTags } from "./version.mjs";

const USAGE = `dot-agents - LLM 向けルールをリポジトリに反映する CLI

使い方:
  dot-agents <command> [options]

コマンド:
  list [--json]   選択可能なルールモジュールを一覧表示する
  init [--lang <names>] [--stack <names>] [--core-only] [--force]
                  ルールモジュールを選んで初期化し、リポジトリに反映する
  sync [--force]  設定に従ってルールを再反映する
  check           反映済みのファイルが手元で編集されていないか確かめる

オプション:
  -h, --help      このヘルプを表示する
  -v, --version   バージョンを表示する
`;

const CORE_LABEL = "（常に含まれる）";

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

  const output = { version: await readPackageVersion() };
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

const splitNames = (value) =>
  (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");

const namesOf = (catalog, category) => catalog[category].map((m) => m.name).join(", ");

const findUnknownNames = (catalog, category, names) =>
  names.filter((name) => !catalog[category].some((m) => m.name === name));

const printSyncResult = (result) => {
  const labels = [
    ["added", "追加"],
    ["updated", "更新"],
    ["removed", "削除"],
    ["unchanged", "変更なし"],
  ];
  for (const [key, label] of labels) {
    for (const relPath of result[key]) {
      console.log(`${label}: ${relPath}`);
    }
  }
  console.log(labels.map(([key, label]) => `${label} ${result[key].length}`).join(" / "));
};

const reportBlockedSync = ({ edited, collisions, problems }) => {
  for (const problem of problems) {
    console.error(problem);
  }
  if (edited.length > 0) {
    console.error("同期済みのファイルがローカルで編集されています:");
    for (const relPath of edited) {
      console.error(`  ${relPath}`);
    }
    console.error(
      "同期したルールの変更は dot-agents 側で行ってください。ローカルの変更を破棄して上書きする場合は --force を指定してください。",
    );
  }
  if (collisions.length > 0) {
    console.error("同名の既存ファイルがあり、管理対象にできません:");
    for (const relPath of collisions) {
      console.error(`  ${relPath}`);
    }
    console.error("上書きする場合は --force を指定してください。");
  }
};

const reflect = async ({ cwd, catalog, selectedIds, recordedFiles, recordedBlocks, force }) => {
  const result = await reflectDotAgents({
    cwd,
    catalog,
    selectedIds,
    recordedFiles,
    recordedBlocks,
    force,
  });
  if (!result.ok) {
    reportBlockedSync(result);
    return 1;
  }
  printSyncResult(result);
  for (const warning of result.warnings) {
    console.error(warning);
  }
  return 0;
};

const reportMissingSelection = (catalog) => {
  console.error("反映するモジュールを指定してください。");
  console.error(`  lang : ${namesOf(catalog, "lang")}`);
  console.error(`  stack: ${namesOf(catalog, "stack")}`);
  console.error("例: dot-agents init --lang typescript --stack vue,tailwind");
  console.error("core のみで初期化する場合は --core-only を指定してください。");
};

const reportAlreadyInitialized = async (cwd) => {
  if ((await readConfig(cwd)) === null) {
    return false;
  }
  console.error(`既に初期化されています（${CONFIG_PATH}）。再反映するには sync を使ってください。`);
  return true;
};

const detectInCatalog = async (cwd, catalog) => {
  const detected = await detectModules(cwd);
  const result = {};
  for (const category of SELECTABLE_CATEGORIES) {
    const unknown = new Set(findUnknownNames(catalog, category, detected[category]));
    result[category] = detected[category].filter((name) => !unknown.has(name));
  }
  return result;
};

const runInit = async (args, { cwd, isInteractive, promptSelection }) => {
  const { values } = parseArgs({
    args,
    options: {
      lang: { type: "string" },
      stack: { type: "string" },
      "core-only": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  const catalog = await loadCatalog();
  let selected = { lang: splitNames(values.lang), stack: splitNames(values.stack) };
  const hasSelection = selected.lang.length > 0 || selected.stack.length > 0;

  if (values["core-only"] && hasSelection) {
    console.error("--core-only は --lang / --stack と同時に指定できません。");
    return 1;
  }
  if (await reportAlreadyInitialized(cwd)) {
    return 1;
  }
  if (!values["core-only"] && !hasSelection) {
    if (!isInteractive) {
      reportMissingSelection(catalog);
      return 1;
    }
    selected = await promptSelection({ catalog, detected: await detectInCatalog(cwd, catalog) });
    if (selected === null) {
      console.error("中止しました");
      return 1;
    }
  }

  let hasUnknown = false;
  for (const category of SELECTABLE_CATEGORIES) {
    const unknown = findUnknownNames(catalog, category, selected[category]);
    if (unknown.length > 0) {
      hasUnknown = true;
      console.error(`未知の ${category} です: ${unknown.join(", ")}`);
      console.error(`  指定できる ${category}: ${namesOf(catalog, category)}`);
    }
  }
  if (hasUnknown) {
    return 1;
  }

  const selectedIds = SELECTABLE_CATEGORIES.flatMap((category) =>
    selected[category].map((name) => `${category}/${name}`),
  );
  return reflect({
    cwd,
    catalog,
    selectedIds: [...new Set(selectedIds)].sort(),
    recordedFiles: {},
    recordedBlocks: {},
    force: values.force,
  });
};

const runSync = async (args, { cwd }) => {
  const { values } = parseArgs({
    args,
    options: { force: { type: "boolean", default: false } },
    allowPositionals: false,
  });
  const config = await readConfig(cwd);
  if (config === null) {
    console.error(`${CONFIG_PATH} が見つかりません。先に init を実行してください。`);
    return 1;
  }

  const catalog = await loadCatalog();
  const knownIds = new Set([...catalog.lang, ...catalog.stack].map((m) => m.id));
  const unknownIds = config.modules.filter((id) => !knownIds.has(id));
  if (unknownIds.length > 0) {
    throw new ConfigError(
      `${CONFIG_PATH} に未知のモジュールがあります: ${unknownIds.join(", ")}`,
    );
  }

  return reflect({
    cwd,
    catalog,
    selectedIds: [...new Set(config.modules)].sort(),
    recordedFiles: config.files,
    recordedBlocks: config.blocks,
    force: values.force,
  });
};

const reportLocalProblems = ({ edited, missing, problems }) => {
  for (const problem of problems) {
    console.error(problem);
  }
  if (edited.length > 0) {
    console.error("同期済みのファイルがローカルで編集されています:");
    for (const relPath of edited) {
      console.error(`  ${relPath}`);
    }
  }
  if (missing.length > 0) {
    console.error("同期済みのファイルが欠落しています:");
    for (const relPath of missing) {
      console.error(`  ${relPath}`);
    }
  }
  console.error(
    "同期したルールの変更は dot-agents 側で行い、sync で反映してください。ローカルの変更を破棄して戻す場合は sync --force を実行してください。",
  );
};

const warnIfOutdated = async (currentVersion, fetchTags) => {
  let tags;
  try {
    tags = await fetchTags();
  } catch (error) {
    const reason = String(error?.message ?? error).split("\n")[0];
    console.error(`最新バージョンを確認できません（${reason}）`);
    return;
  }

  const latestVersion = findLatestVersion(tags);
  if (latestVersion === null || compareVersions(latestVersion, currentVersion) <= 0) {
    return;
  }
  console.error(`新しいバージョン v${latestVersion} があります`);
  console.error(`  現在 v${currentVersion}`);
  console.error(`  npx github:otTATto/dot-agents#v${latestVersion} sync`);
};

const runCheck = async (args, { cwd, listRemoteTags: fetchTags }) => {
  parseArgs({ args, options: {}, allowPositionals: false });
  const config = await readConfig(cwd);
  if (config === null) {
    console.error(`${CONFIG_PATH} が見つかりません。先に init を実行してください。`);
    return 1;
  }

  const local = await findLocalProblems({ cwd, config });
  const hasProblems = local.edited.length + local.missing.length + local.problems.length > 0;
  if (hasProblems) {
    reportLocalProblems(local);
  }
  await warnIfOutdated(config.version, fetchTags);
  if (hasProblems) {
    return 1;
  }
  console.log(`問題ありません（dot-agents v${config.version}）`);
  return 0;
};

const COMMANDS = {
  list: runList,
  init: runInit,
  sync: runSync,
  check: runCheck,
};

/**
 * @function CLI を実行し、終了コードを返す
 *
 * @param argv サブコマンド以降の引数配列（process.argv.slice(2) 相当）
 * @param options.cwd 対象リポジトリのルート（既定は process.cwd()）
 * @param options.listRemoteTags check が最新バージョンの確認に使うタグ名の取得関数（既定は version.mjs の listRemoteTags）
 * @param options.isInteractive init で --lang / --stack / --core-only 未指定時に対話選択へ進むか（既定は標準入出力がどちらも TTY）
 * @param options.promptSelection init の対話選択（既定は prompt.mjs の promptSelection）。{ lang, stack } を返し、キャンセル時は null
 * @returns プロセスの終了コード（正常時 0、未知のコマンド・不正なオプション・不正な設定・反映の衝突時、check で問題が見つかった時 1）
 *
 * NOTE:
 *   - 出力は標準出力、エラーと未知コマンド時の usage は標準エラーに書く
 *   - コマンド内で発生した予期しない例外は呼び出し元に伝播する
 *   - check は最新バージョンを確認できなくても失敗にせず、警告を標準エラーに書く
 *   - init の対話選択がキャンセルされた場合は何も書かず 1 を返す
 */
export const run = async (
  argv,
  {
    cwd = process.cwd(),
    listRemoteTags: fetchTags = listRemoteTags,
    isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
    promptSelection = defaultPromptSelection,
  } = {},
) => {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    console.log(await readPackageVersion());
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`未知のコマンドです: ${command}\n`);
    console.error(USAGE);
    return 1;
  }

  try {
    return await handler(rest, { cwd, listRemoteTags: fetchTags, isInteractive, promptSelection });
  } catch (error) {
    if (error instanceof ConfigError || error?.code?.startsWith("ERR_PARSE_ARGS_")) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
};
