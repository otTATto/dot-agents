import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { test } from "node:test";
import { loadCatalog } from "../src/modules.mjs";

test("カタログに期待するモジュールが含まれる", async () => {
  const catalog = await loadCatalog();
  const ids = Object.values(catalog).flat().map((m) => m.id);

  for (const id of ["core/comment", "core/review", "lang/typescript", "lang/rust", "stack/vue", "stack/web"]) {
    assert.ok(ids.includes(id), `${id} がありません`);
  }
});

test("見出しが title として取り出され、path は絶対パスになる", async () => {
  const catalog = await loadCatalog();
  const vue = catalog.stack.find((m) => m.name === "vue");

  assert.equal(vue.title, "Vue に関するルールや考え方");
  assert.equal(vue.category, "stack");
  assert.ok(isAbsolute(vue.path));
});

test("各カテゴリは name 昇順に並ぶ", async () => {
  const catalog = await loadCatalog();

  for (const modules of Object.values(catalog)) {
    const names = modules.map((m) => m.name);
    assert.deepEqual(names, [...names].sort());
  }
});
