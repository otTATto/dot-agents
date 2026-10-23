import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "../src/cli.mjs";

const makeRepo = async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "dot-agents-test-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
};

const runQuiet = async (t, argv, cwd, options = {}) => {
  const stdout = [];
  const stderr = [];
  t.mock.method(console, "log", (...args) => stdout.push(args.join(" ")));
  t.mock.method(console, "error", (...args) => stderr.push(args.join(" ")));
  const code = await run(argv, { cwd, isInteractive: false, ...options });
  t.mock.restoreAll();
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
};

const NO_TAGS = { listRemoteTags: async () => [] };
const CONFIG_PATH = ".agents/dot-agents.json";

const initRepo = async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, ["init", "--lang", "typescript"], cwd);
  return cwd;
};

const snapshot = async (cwd) => {
  const entries = await readdir(cwd, { recursive: true });
  const stats = {};
  for (const entry of entries.sort()) {
    const info = await stat(join(cwd, entry));
    stats[entry] = info.isFile() ? `${info.size}:${info.mtimeMs}` : "dir";
  }
  return stats;
};

const appendTo = async (path, text) => writeFile(path, `${await readFile(path, "utf8")}${text}`);

test("check は init 直後なら 0 を返し、何も書き込まない", async (t) => {
  const cwd = await initRepo(t);
  const before = await snapshot(cwd);

  const { code, stdout, stderr } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 0);
  assert.match(stdout, /問題ありません（dot-agents v\d+\.\d+\.\d+）/);
  assert.equal(stderr, "");
  assert.deepEqual(await snapshot(cwd), before);
});

test("check は編集されたルールファイルを列挙して 1 を返す", async (t) => {
  const cwd = await initRepo(t);
  await appendTo(join(cwd, ".agents/rules/git.md"), "edited\n");

  const { code, stderr } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 1);
  assert.match(stderr, /編集されています/);
  assert.match(stderr, /\.agents\/rules\/git\.md/);
  assert.match(stderr, /sync --force/);
});

test("check は削除されたルールファイルを欠落として 1 を返す", async (t) => {
  const cwd = await initRepo(t);
  await rm(join(cwd, ".agents/rules/typescript.md"));

  const { code, stderr } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 1);
  assert.match(stderr, /欠落/);
  assert.match(stderr, /\.agents\/rules\/typescript\.md/);
});

test("check は AGENTS.md の管理ブロックの編集を検出して 1 を返す", async (t) => {
  const cwd = await initRepo(t);
  const path = join(cwd, "AGENTS.md");
  const text = await readFile(path, "utf8");
  await writeFile(path, text.replace("<!-- dot-agents:end -->", "追記\n\n<!-- dot-agents:end -->"));

  const { code, stderr } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 1);
  assert.match(stderr, /編集されています/);
  assert.match(stderr, /AGENTS\.md/);
});

test("check は管理ブロックの外側の編集を問題にしない", async (t) => {
  const cwd = await initRepo(t);
  await appendTo(join(cwd, "AGENTS.md"), "このリポジトリ固有のルール\n");

  const { code } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 0);
});

test("check は AGENTS.md のマーカーが消えていると問題を報告して 1 を返す", async (t) => {
  const cwd = await initRepo(t);
  await writeFile(join(cwd, "AGENTS.md"), "# ルール\n");

  const { code, stderr } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 1);
  assert.match(stderr, /マーカー/);
});

test("check は AGENTS.md が削除されていると欠落として 1 を返す", async (t) => {
  const cwd = await initRepo(t);
  await rm(join(cwd, "AGENTS.md"));

  const { code, stderr } = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(code, 1);
  assert.match(stderr, /欠落/);
  assert.match(stderr, /AGENTS\.md/);
});

test("check は設定がない場合に 1 を返し、不正な設定も 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  const missing = await runQuiet(t, ["check"], cwd, NO_TAGS);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /init/);

  const initialized = await initRepo(t);
  await writeFile(join(initialized, CONFIG_PATH), "{ not json");
  assert.equal((await runQuiet(t, ["check"], initialized, NO_TAGS)).code, 1);
});

test("check は新しいバージョンがあれば警告するが、終了コードは変えない", async (t) => {
  const cwd = await initRepo(t);
  const listRemoteTags = async () => ["v0.0.1", "v0.10.0", "v0.9.0", "v1.0.0-beta.1"];

  const { code, stdout, stderr } = await runQuiet(t, ["check"], cwd, { listRemoteTags });
  assert.equal(code, 0);
  assert.match(stdout, /問題ありません/);
  assert.match(stderr, /新しいバージョン v0\.10\.0 があります/);
  assert.match(stderr, /npx github:otTATto\/dot-agents#v0\.10\.0 sync/);
});

test("check は同じか古いバージョンしかなければ警告しない", async (t) => {
  const cwd = await initRepo(t);
  const { version } = JSON.parse(await readFile(join(cwd, CONFIG_PATH), "utf8"));

  const same = await runQuiet(t, ["check"], cwd, { listRemoteTags: async () => [`v${version}`] });
  assert.equal(same.code, 0);
  assert.equal(same.stderr, "");

  const config = JSON.parse(await readFile(join(cwd, CONFIG_PATH), "utf8"));
  await writeFile(join(cwd, CONFIG_PATH), JSON.stringify({ ...config, version: "5.0.0" }));
  const older = await runQuiet(t, ["check"], cwd, { listRemoteTags: async () => ["v1.0.0"] });
  assert.equal(older.code, 0);
  assert.equal(older.stderr, "");
});

test("check はタグを取得できなくても警告だけで続行する", async (t) => {
  const cwd = await initRepo(t);
  const listRemoteTags = async () => {
    throw new Error("network down");
  };

  const { code, stdout, stderr } = await runQuiet(t, ["check"], cwd, { listRemoteTags });
  assert.equal(code, 0);
  assert.match(stdout, /問題ありません/);
  assert.match(stderr, /確認できません/);
  assert.match(stderr, /network down/);
});

test("check は問題がある場合もバージョンの警告を出す", async (t) => {
  const cwd = await initRepo(t);
  await appendTo(join(cwd, ".agents/rules/git.md"), "edited\n");

  const { code, stderr } = await runQuiet(t, ["check"], cwd, {
    listRemoteTags: async () => ["v9.0.0"],
  });
  assert.equal(code, 1);
  assert.match(stderr, /v9\.0\.0/);
});
