import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPOSITORY_URL } from "./package.mjs";

const execFileAsync = promisify(execFile);

const LS_REMOTE_TIMEOUT_MS = 10_000;

const TAG_REF_PREFIX = "refs/tags/";

const RELEASE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

const parseVersion = (version) => version.split(".").map(Number);

/**
 * @function dot-agents のリポジトリのタグ名を git ls-remote で取得する
 *
 * @returns タグ名の配列（例: ["v0.1.0", "v0.2.0"]）。タグがなければ空配列
 * @throws git の実行に失敗した場合（git がない、オフライン、タイムアウトなど）
 */
export const listRemoteTags = async () => {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-remote", "--tags", "--refs", REPOSITORY_URL],
    { timeout: LS_REMOTE_TIMEOUT_MS },
  );
  return stdout
    .split("\n")
    .map((line) => line.split("\t")[1])
    .filter((ref) => ref?.startsWith(TAG_REF_PREFIX))
    .map((ref) => ref.slice(TAG_REF_PREFIX.length));
};

/**
 * @function "X.Y.Z" 形式のバージョン 2 つを数値で比較する
 *
 * @returns a が新しければ正、b が新しければ負、同じなら 0
 */
export const compareVersions = (a, b) => {
  const [partsA, partsB] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < partsA.length; i++) {
    if (partsA[i] !== partsB[i]) {
      return partsA[i] - partsB[i];
    }
  }
  return 0;
};

/**
 * @function タグ名の配列から最も新しいリリースのバージョンを探す
 *
 * @returns "X.Y.Z" 形式のバージョン（v は付けない）。該当するタグがなければ null
 *
 * NOTE: vX.Y.Z 形式のタグのみを対象とし、プレリリースなどそれ以外のタグは無視する
 */
export const findLatestVersion = (tags) => {
  const versions = tags
    .map((tag) => RELEASE_TAG_PATTERN.exec(tag))
    .filter((match) => match !== null)
    .map((match) => match.slice(1).join("."));
  if (versions.length === 0) {
    return null;
  }
  return versions.reduce((latest, v) => (compareVersions(v, latest) > 0 ? v : latest));
};
