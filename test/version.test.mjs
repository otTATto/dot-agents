import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersions, findLatestVersion } from "../src/version.mjs";

test("compareVersions はバージョンを数値で比較する", () => {
  assert.ok(compareVersions("0.10.0", "0.9.0") > 0);
  assert.ok(compareVersions("0.1.0", "0.1.1") < 0);
  assert.ok(compareVersions("2.0.0", "1.99.99") > 0);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("findLatestVersion は vX.Y.Z 以外のタグを無視して最も新しいバージョンを返す", () => {
  const tags = ["v0.9.0", "v0.10.0", "v1.0.0-beta.1", "v0.2", "latest", "0.20.0", "v0.1.0"];
  assert.equal(findLatestVersion(tags), "0.10.0");
});

test("findLatestVersion は該当するタグがなければ null を返す", () => {
  assert.equal(findLatestVersion([]), null);
  assert.equal(findLatestVersion(["v1.0.0-rc.1", "latest"]), null);
});
