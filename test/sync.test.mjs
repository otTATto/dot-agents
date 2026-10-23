import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "../src/cli.mjs";
import { hashContent } from "../src/config.mjs";
import { assertUniqueNames } from "../src/modules.mjs";

const CORE_NAMES = ["comment", "documentation", "git", "naming", "readability", "review"];

const makeRepo = async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "dot-agents-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
};

const runQuiet = async (t, argv, cwd) => {
  const stdout = [];
  const stderr = [];
  t.mock.method(console, "log", (...args) => stdout.push(args.join(" ")));
  t.mock.method(console, "error", (...args) => stderr.push(args.join(" ")));
  const code = await run(argv, { cwd, isInteractive: false });
  t.mock.restoreAll();
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
};

const configPath = (cwd) => join(cwd, ".agents/dot-agents.json");
const readJson = async (cwd) => JSON.parse(await readFile(configPath(cwd), "utf8"));
const listRules = async (cwd) => (await readdir(join(cwd, ".agents/rules"))).sort();
const rulePath = (cwd, name) => join(cwd, ".agents/rules", `${name}.md`);

test("init は core と選択モジュールをヘッダー付きで書き、設定にハッシュを記録する", async (t) => {
  const cwd = await makeRepo(t);
  const { code } = await runQuiet(t, ["init", "--lang", "typescript", "--stack", "vue"], cwd);
  assert.equal(code, 0);

  assert.deepEqual(
    await listRules(cwd),
    [...CORE_NAMES, "typescript", "vue"].sort().map((n) => `${n}.md`),
  );

  const vue = await readFile(rulePath(cwd, "vue"), "utf8");
  assert.match(vue, /^<!-- dot-agents v\d+\.\d+\.\d+ から同期したファイルです。\n {5}直接編集せず、.*-->\n\n# /);
  assert.ok(!vue.includes("\r"));

  const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const config = await readJson(cwd);
  assert.equal(config.version, version);
  assert.deepEqual(config.modules, ["lang/typescript", "stack/vue"]);
  assert.equal(Object.keys(config.files).length, CORE_NAMES.length + 2);
  assert.equal(config.files[".agents/rules/vue.md"], hashContent(vue));
  assert.deepEqual(Object.keys(config.files), Object.keys(config.files).sort());
  assert.ok((await readFile(configPath(cwd), "utf8")).endsWith("}\n"));
});

test("init は未知の名前を報告して 1 を返し、何も書かない", async (t) => {
  const cwd = await makeRepo(t);
  const { code, stderr } = await runQuiet(t, ["init", "--lang", "typescript,nope"], cwd);

  assert.equal(code, 1);
  assert.match(stderr, /nope/);
  assert.match(stderr, /rust/);
  assert.ok(!existsSync(join(cwd, ".agents")));
});

test("init はモジュール未指定なら 1 を返し、--core-only なら core だけ書く", async (t) => {
  const cwd = await makeRepo(t);
  const missing = await runQuiet(t, ["init"], cwd);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /--core-only/);
  assert.ok(!existsSync(join(cwd, ".agents")));

  const coreOnly = await runQuiet(t, ["init", "--core-only"], cwd);
  assert.equal(coreOnly.code, 0);
  assert.deepEqual(await listRules(cwd), CORE_NAMES.map((n) => `${n}.md`));
  assert.deepEqual((await readJson(cwd)).modules, []);
});

test("init は --core-only と --lang の併用を拒否する", async (t) => {
  const cwd = await makeRepo(t);
  const { code } = await runQuiet(t, ["init", "--core-only", "--lang", "rust"], cwd);
  assert.equal(code, 1);
  assert.ok(!existsSync(join(cwd, ".agents")));
});

test("init は 2 回目に 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  assert.equal((await runQuiet(t, ["init", "--core-only"], cwd)).code, 0);
  const second = await runQuiet(t, ["init", "--core-only"], cwd);
  assert.equal(second.code, 1);
  assert.match(second.stderr, /sync/);
});

test("sync は設定から外したモジュールのファイルを削除する", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, ["init", "--lang", "typescript", "--stack", "vue"], cwd);

  const config = await readJson(cwd);
  config.modules = ["lang/typescript"];
  await writeFile(configPath(cwd), JSON.stringify(config));

  const { code, stdout } = await runQuiet(t, ["sync"], cwd);
  assert.equal(code, 0);
  assert.match(stdout, /削除: \.agents\/rules\/vue\.md/);
  assert.ok(!existsSync(rulePath(cwd, "vue")));
  assert.ok(!(".agents/rules/vue.md" in (await readJson(cwd)).files));
});

test("sync は変更のないファイルを変更なしとして報告する", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, ["init", "--core-only"], cwd);
  const { code, stdout } = await runQuiet(t, ["sync"], cwd);

  assert.equal(code, 0);
  assert.match(stdout, /追加 0 \/ 更新 0 \/ 削除 0 \/ 変更なし 7/);
});

test("sync はローカル編集があると 1 を返して何も変えず、--force で上書きする", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, ["init", "--lang", "typescript"], cwd);
  const original = await readFile(rulePath(cwd, "comment"), "utf8");
  await writeFile(rulePath(cwd, "comment"), `${original}edited\n`);

  const config = await readJson(cwd);
  config.modules = [];
  await writeFile(configPath(cwd), JSON.stringify(config));

  const blocked = await runQuiet(t, ["sync"], cwd);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /\.agents\/rules\/comment\.md/);
  assert.match(blocked.stderr, /--force/);
  assert.equal(await readFile(rulePath(cwd, "comment"), "utf8"), `${original}edited\n`);
  assert.ok(existsSync(rulePath(cwd, "typescript")));

  const forced = await runQuiet(t, ["sync", "--force"], cwd);
  assert.equal(forced.code, 0);
  assert.equal(await readFile(rulePath(cwd, "comment"), "utf8"), original);
  assert.ok(!existsSync(rulePath(cwd, "typescript")));
});

test("CRLF に変換された管理ファイルはローカル編集とみなさない", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, ["init", "--core-only"], cwd);
  const original = await readFile(rulePath(cwd, "git"), "utf8");
  await writeFile(rulePath(cwd, "git"), original.replaceAll("\n", "\r\n"));

  const { code, stdout } = await runQuiet(t, ["sync"], cwd);
  assert.equal(code, 0);
  assert.match(stdout, /変更なし 7/);
});

test("管理外の同名ファイルは --force なしだと 1 を返し、何も書かない", async (t) => {
  const cwd = await makeRepo(t);
  await mkdir(join(cwd, ".agents/rules"), { recursive: true });
  await writeFile(rulePath(cwd, "git"), "mine\n");

  const blocked = await runQuiet(t, ["init", "--core-only"], cwd);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /\.agents\/rules\/git\.md/);
  assert.deepEqual(await listRules(cwd), ["git.md"]);
  assert.ok(!existsSync(configPath(cwd)));

  const forced = await runQuiet(t, ["init", "--core-only", "--force"], cwd);
  assert.equal(forced.code, 0);
  assert.notEqual(await readFile(rulePath(cwd, "git"), "utf8"), "mine\n");
});

test("設定がない場合や不正な場合、sync は 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  const missing = await runQuiet(t, ["sync"], cwd);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /init/);

  await mkdir(join(cwd, ".agents"), { recursive: true });
  await writeFile(configPath(cwd), "{ not json");
  assert.equal((await runQuiet(t, ["sync"], cwd)).code, 1);

  await writeFile(
    configPath(cwd),
    JSON.stringify({ version: "0.0.0", modules: ["lang/nope"], files: {} }),
  );
  const unknown = await runQuiet(t, ["sync"], cwd);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /lang\/nope/);
});

test("assertUniqueNames はカテゴリをまたぐ name の重複を検出する", () => {
  const ok = { core: [{ id: "core/a", name: "a" }], lang: [{ id: "lang/b", name: "b" }] };
  assert.doesNotThrow(() => assertUniqueNames(ok));

  const dup = { core: [{ id: "core/a", name: "a" }], stack: [{ id: "stack/a", name: "a" }] };
  assert.throws(() => assertUniqueNames(dup), /core\/a.*stack\/a/);
});

const runInteractive = async (t, cwd, promptSelection, argv = ["init"]) => {
  const stderr = [];
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", (...args) => stderr.push(args.join(" ")));
  const code = await run(argv, { cwd, isInteractive: true, promptSelection });
  t.mock.restoreAll();
  return { code, stderr: stderr.join("\n") };
};

test("対話 init は検出結果をプロンプトに渡し、選択結果を反映する", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(join(cwd, "package.json"), JSON.stringify({ dependencies: { vue: "^3" } }));

  let received;
  const { code } = await runInteractive(t, cwd, async ({ catalog, detected }) => {
    received = { hasCatalog: catalog.lang.length > 0, detected };
    return { lang: ["typescript"], stack: ["vue"] };
  });

  assert.equal(code, 0);
  assert.deepEqual(received, {
    hasCatalog: true,
    detected: { lang: ["typescript"], stack: ["vue", "web"] },
  });
  assert.deepEqual((await readJson(cwd)).modules, ["lang/typescript", "stack/vue"]);
});

test("対話 init で何も選ばなければ core のみを反映する", async (t) => {
  const cwd = await makeRepo(t);
  const { code } = await runInteractive(t, cwd, async () => ({ lang: [], stack: [] }));

  assert.equal(code, 0);
  assert.deepEqual(await listRules(cwd), CORE_NAMES.map((n) => `${n}.md`));
});

test("対話 init がキャンセルされたら 1 を返し、何も書かない", async (t) => {
  const cwd = await makeRepo(t);
  const { code, stderr } = await runInteractive(t, cwd, async () => null);

  assert.equal(code, 1);
  assert.match(stderr, /中止しました/);
  assert.ok(!existsSync(join(cwd, ".agents")));
});

test("初期化済みなら対話 init はプロンプトを出さずに 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, ["init", "--core-only"], cwd);

  let isCalled = false;
  const { code, stderr } = await runInteractive(t, cwd, async () => {
    isCalled = true;
    return { lang: [], stack: [] };
  });

  assert.equal(code, 1);
  assert.match(stderr, /既に初期化されています/);
  assert.equal(isCalled, false);
});

test("非対話では引数なしの init はプロンプトを出さずに 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  let isCalled = false;
  const stderr = [];
  t.mock.method(console, "error", (...args) => stderr.push(args.join(" ")));
  const code = await run(["init"], {
    cwd,
    isInteractive: false,
    promptSelection: async () => {
      isCalled = true;
      return null;
    },
  });
  t.mock.restoreAll();

  assert.equal(code, 1);
  assert.match(stderr.join("\n"), /--core-only/);
  assert.equal(isCalled, false);
  assert.ok(!existsSync(join(cwd, ".agents")));
});
