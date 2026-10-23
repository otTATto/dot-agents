import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BEGIN_MARKER, END_MARKER, buildAgentsMdBlock, mergeAgentsMd } from "../src/agents-md.mjs";
import { run } from "../src/cli.mjs";
import { hashContent } from "../src/config.mjs";

const SHARED = await readFile(new URL("../agents-md/shared.md", import.meta.url), "utf8");
const BLOCK = buildAgentsMdBlock(SHARED);

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

const agentsPath = (cwd) => join(cwd, "AGENTS.md");
const claudePath = (cwd) => join(cwd, "CLAUDE.md");
const configPath = (cwd) => join(cwd, ".agents/dot-agents.json");
const readJson = async (cwd) => JSON.parse(await readFile(configPath(cwd), "utf8"));
const INIT = ["init", "--core-only"];

test("init は AGENTS.md と CLAUDE.md を新規作成し、ブロックのハッシュを記録する", async (t) => {
  const cwd = await makeRepo(t);
  const { code, stdout } = await runQuiet(t, INIT, cwd);
  assert.equal(code, 0);

  assert.equal(
    await readFile(agentsPath(cwd), "utf8"),
    `# プロジェクト全体のルール\n\n${BLOCK}\n\n## このリポジトリについて\n`,
  );
  assert.ok(BLOCK.includes("## コミュニケーション"));
  assert.equal(await readFile(claudePath(cwd), "utf8"), "@AGENTS.md\n");
  assert.equal((await readJson(cwd)).blocks["AGENTS.md"], hashContent(BLOCK));
  assert.match(stdout, /追加: AGENTS\.md/);
  assert.match(stdout, /追加: CLAUDE\.md/);
});

test("マーカー付きの既存 AGENTS.md はブロックだけを置き換え、外側を保つ", async (t) => {
  const cwd = await makeRepo(t);
  const before = "# 自作\n\n前の文章\n\n";
  const after = "\n\n## 独自ルール\n\n- 自分の項目\n";
  await writeFile(
    agentsPath(cwd),
    `${before}${BEGIN_MARKER}\n\n古い内容\n\n${END_MARKER}${after}`,
  );

  const { code, stdout } = await runQuiet(t, INIT, cwd);
  assert.equal(code, 0);
  assert.equal(await readFile(agentsPath(cwd), "utf8"), `${before}${BLOCK}${after}`);
  assert.match(stdout, /更新: AGENTS\.md/);
});

test("マーカーのない既存 AGENTS.md は --force でも変更せず、何も書かない", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(agentsPath(cwd), "# 既存\n");

  for (const argv of [INIT, [...INIT, "--force"]]) {
    const { code, stderr } = await runQuiet(t, argv, cwd);
    assert.equal(code, 1);
    assert.match(stderr, /マーカー/);
    assert.ok(stderr.includes(BEGIN_MARKER));
    assert.ok(stderr.includes(END_MARKER));
    assert.equal(await readFile(agentsPath(cwd), "utf8"), "# 既存\n");
    assert.ok(!existsSync(join(cwd, ".agents")));
    assert.ok(!existsSync(claudePath(cwd)));
  }
});

test("マーカーの不備と同名ファイルの衝突は、まとめて報告する", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(agentsPath(cwd), "# 既存\n");
  await mkdir(join(cwd, ".agents", "rules"), { recursive: true });
  await writeFile(join(cwd, ".agents", "rules", "comment.md"), "# 手元のルール\n");

  const { code, stderr } = await runQuiet(t, INIT, cwd);
  assert.equal(code, 1);
  assert.match(stderr, /マーカー/);
  assert.ok(stderr.includes(".agents/rules/comment.md"));

  const forced = await runQuiet(t, [...INIT, "--force"], cwd);
  assert.equal(forced.code, 1);
  assert.match(forced.stderr, /マーカー/);
  assert.ok(!forced.stderr.includes(".agents/rules/comment.md"));
  assert.equal(await readFile(join(cwd, ".agents", "rules", "comment.md"), "utf8"), "# 手元のルール\n");
});

test("マーカーが不正な AGENTS.md は 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  const malformed = [
    `${BEGIN_MARKER}\n${BEGIN_MARKER}\n${END_MARKER}\n`,
    `${END_MARKER}\n${BEGIN_MARKER}\n`,
    `${BEGIN_MARKER}\n`,
  ];

  for (const content of malformed) {
    await writeFile(agentsPath(cwd), content);
    const { code, stderr } = await runQuiet(t, [...INIT, "--force"], cwd);
    assert.equal(code, 1);
    assert.match(stderr, /不正/);
    assert.ok(!existsSync(join(cwd, ".agents")));
  }
});

test("ブロック内の編集は sync を止め、--force で上書きして外側を保つ", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, INIT, cwd);
  const original = await readFile(agentsPath(cwd), "utf8");
  const edited = original.replace("## コミュニケーション", "## 改変");
  const outside = edited.replace("## このリポジトリについて", "## このリポジトリについて\n\n自分の説明\n");
  await writeFile(agentsPath(cwd), outside);

  const blocked = await runQuiet(t, ["sync"], cwd);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /AGENTS\.md/);
  assert.match(blocked.stderr, /--force/);
  assert.equal(await readFile(agentsPath(cwd), "utf8"), outside);

  const forced = await runQuiet(t, ["sync", "--force"], cwd);
  assert.equal(forced.code, 0);
  assert.equal(
    await readFile(agentsPath(cwd), "utf8"),
    original.replace("## このリポジトリについて", "## このリポジトリについて\n\n自分の説明\n"),
  );
});

test("ブロックの外側の編集はローカル編集とみなさない", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, INIT, cwd);
  const original = await readFile(agentsPath(cwd), "utf8");
  await writeFile(agentsPath(cwd), `${original}追記\n`);

  const { code, stdout } = await runQuiet(t, ["sync"], cwd);
  assert.equal(code, 0);
  assert.match(stdout, /変更なし: AGENTS\.md/);
  assert.equal(await readFile(agentsPath(cwd), "utf8"), `${original}追記\n`);
});

test("@AGENTS.md のない既存 CLAUDE.md は変更せず、警告だけ出す", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(claudePath(cwd), "# 自作\n");

  const { code, stdout, stderr } = await runQuiet(t, INIT, cwd);
  assert.equal(code, 0);
  assert.equal(await readFile(claudePath(cwd), "utf8"), "# 自作\n");
  assert.match(stderr, /@AGENTS\.md/);
  assert.ok(!stdout.includes("CLAUDE.md"));
});

test("@AGENTS.md を含む既存 CLAUDE.md は警告しない", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(claudePath(cwd), "# 自作\r\n  @AGENTS.md  \r\n");

  const { code, stderr } = await runQuiet(t, INIT, cwd);
  assert.equal(code, 0);
  assert.equal(stderr, "");
});

test("2 回目の sync は AGENTS.md を変更なしとし、CLAUDE.md を追加として報告しない", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, INIT, cwd);
  const { code, stdout } = await runQuiet(t, ["sync"], cwd);

  assert.equal(code, 0);
  assert.match(stdout, /変更なし: AGENTS\.md/);
  assert.ok(!stdout.includes("CLAUDE.md"));
  assert.match(stdout, /追加 0 \/ 更新 0 \/ 削除 0 \/ 変更なし 7/);
});

test("CRLF に変換された AGENTS.md はローカル編集とみなさない", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, INIT, cwd);
  const original = await readFile(agentsPath(cwd), "utf8");
  await writeFile(agentsPath(cwd), original.replaceAll("\n", "\r\n"));

  const { code, stdout } = await runQuiet(t, ["sync"], cwd);
  assert.equal(code, 0);
  assert.match(stdout, /変更なし: AGENTS\.md/);
});

test("blocks のない設定でも sync でき、blocks が追記される", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, INIT, cwd);
  const { blocks, ...legacy } = await readJson(cwd);
  await writeFile(configPath(cwd), JSON.stringify(legacy));

  const { code } = await runQuiet(t, ["sync"], cwd);
  assert.equal(code, 0);
  assert.deepEqual((await readJson(cwd)).blocks, blocks);
  assert.deepEqual(Object.keys(await readJson(cwd)), ["version", "modules", "files", "blocks"]);
});

test("blocks がオブジェクトでない設定は 1 を返す", async (t) => {
  const cwd = await makeRepo(t);
  await runQuiet(t, INIT, cwd);
  const config = await readJson(cwd);
  await writeFile(configPath(cwd), JSON.stringify({ ...config, blocks: [] }));

  const { code, stderr } = await runQuiet(t, ["sync"], cwd);
  assert.equal(code, 1);
  assert.match(stderr, /blocks/);
});

test("mergeAgentsMd はブロックの外側を保ち、置き換え前のブロックを返す", () => {
  const merged = mergeAgentsMd(`a\n${BEGIN_MARKER}\nold\n${END_MARKER}\nb\n`, BLOCK);
  assert.equal(merged.text, `a\n${BLOCK}\nb\n`);
  assert.equal(merged.currentBlock, `${BEGIN_MARKER}\nold\n${END_MARKER}`);
});
