import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dot-agents.mjs", import.meta.url));

const runCli = (...args) =>
  spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });

test("list --json は全カテゴリとバージョンを返し、絶対パスを含まない", () => {
  const result = runCli("list", "--json");
  assert.equal(result.status, 0);

  const json = JSON.parse(result.stdout);
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(json.version, version);
  for (const category of ["core", "lang", "stack"]) {
    assert.ok(json[category].length > 0);
  }
  assert.ok(json.core.some((m) => m.id === "core/comment"));
  assert.ok(json.stack.every((m) => !("path" in m)));
});

test("list はカテゴリごとにグルーピングして表示する", () => {
  const result = runCli("list");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^core（常に含まれる）$/m);
  assert.match(result.stdout, /^lang$/m);
  assert.match(result.stdout, /^stack$/m);
});

test("--help は usage を標準出力に出して 0 で終了する", () => {
  const result = runCli("--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /使い方/);
});

test("--version は package.json のバージョンを出力する", () => {
  const result = runCli("--version");
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("未知のコマンドは usage を標準エラーに出して 1 で終了する", () => {
  const result = runCli("nope");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /使い方/);
});
