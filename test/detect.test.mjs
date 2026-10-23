import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detectModules } from "../src/detect.mjs";

const makeRepo = async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "dot-agents-detect-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
};

const writePackageJson = (cwd, manifest) =>
  writeFile(join(cwd, "package.json"), JSON.stringify(manifest));

test("Vue + Tailwind + Lucide + Tauri のリポジトリから lang / stack を推定する", async (t) => {
  const cwd = await makeRepo(t);
  await writePackageJson(cwd, {
    dependencies: { vue: "^3", "lucide-vue-next": "^1" },
    devDependencies: { tailwindcss: "^4", vite: "^6" },
  });
  await mkdir(join(cwd, "src-tauri"));
  await writeFile(join(cwd, "src-tauri", "Cargo.toml"), "");

  assert.deepEqual(await detectModules(cwd), {
    lang: ["rust", "typescript"],
    stack: ["lucide", "tailwind", "vue", "web"],
  });
});

test("Astro のリポジトリでは lucide を含めない", async (t) => {
  const cwd = await makeRepo(t);
  await writePackageJson(cwd, {
    dependencies: { astro: "^5" },
    devDependencies: { "@tailwindcss/vite": "^4" },
  });

  assert.deepEqual(await detectModules(cwd), {
    lang: ["typescript"],
    stack: ["astro", "tailwind", "web"],
  });
});

test("空のディレクトリでは何も推定しない", async (t) => {
  const cwd = await makeRepo(t);
  assert.deepEqual(await detectModules(cwd), { lang: [], stack: [] });
});

test("package.json が不正な JSON でも例外にせず、依存なしとして扱う", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(join(cwd, "package.json"), "{ broken");

  assert.deepEqual(await detectModules(cwd), { lang: ["typescript"], stack: [] });
});

test("tsconfig.json だけでも typescript を推定する", async (t) => {
  const cwd = await makeRepo(t);
  await writeFile(join(cwd, "tsconfig.json"), "{}");

  assert.deepEqual(await detectModules(cwd), { lang: ["typescript"], stack: [] });
});

test("深い階層の Cargo.toml からも rust を推定する", async (t) => {
  const cwd = await makeRepo(t);
  await mkdir(join(cwd, "crates", "core"), { recursive: true });
  await writeFile(join(cwd, "crates", "core", "Cargo.toml"), "");

  assert.deepEqual(await detectModules(cwd), { lang: ["rust"], stack: [] });
});

test("node_modules などの中にある Cargo.toml は無視する", async (t) => {
  const cwd = await makeRepo(t);
  await mkdir(join(cwd, "node_modules", "some-pkg"), { recursive: true });
  await writeFile(join(cwd, "node_modules", "some-pkg", "Cargo.toml"), "");

  assert.deepEqual(await detectModules(cwd), { lang: [], stack: [] });
});
