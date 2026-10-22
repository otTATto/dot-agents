import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hashContent, readTextIfExists } from "./config.mjs";

const toAbsolute = (cwd, relPath) => join(cwd, ...relPath.split("/"));

const findEditedFiles = async (cwd, recordedFiles) => {
  const edited = [];
  for (const [relPath, recordedHash] of Object.entries(recordedFiles)) {
    const current = await readTextIfExists(toAbsolute(cwd, relPath));
    if (current !== null && hashContent(current) !== recordedHash) {
      edited.push(relPath);
    }
  }
  return edited.sort();
};

const findCollisions = (cwd, desiredFiles, recordedFiles) =>
  [...desiredFiles.keys()]
    .filter((relPath) => !(relPath in recordedFiles) && existsSync(toAbsolute(cwd, relPath)))
    .sort();

/**
 * @function 同期で上書き・削除してしまうローカルの状態（編集と衝突）を調べる
 *
 * @param options.cwd 対象リポジトリのルート
 * @param options.desiredFiles 同期後にあるべきファイル（相対パスをキー、中身を値とする Map）
 * @param options.recordedFiles 設定ファイルに記録済みの files（初回は {}）
 * @returns { edited, collisions }（いずれもファイルパスの昇順の配列）
 *
 * NOTE:
 *   - edited: 記録済みのハッシュと現在の内容が異なる管理ファイル
 *   - collisions: 管理外なのに同期先と同名で既に存在するファイル
 *   - 記録済みでディスク上に無いファイルは衝突ではなく、再作成される
 */
export const findSyncConflicts = async ({ cwd, desiredFiles, recordedFiles }) => ({
  edited: await findEditedFiles(cwd, recordedFiles),
  collisions: findCollisions(cwd, desiredFiles, recordedFiles),
});

/**
 * @function dot-agents が管理するファイルを、対象リポジトリに書き込み・削除して同期する
 *
 * @param options.cwd 対象リポジトリのルート
 * @param options.desiredFiles 同期後にあるべきファイル（相対パスをキー、中身を値とする Map）
 * @param options.recordedFiles 設定ファイルに記録済みの files（初回は {}）
 * @returns { added, updated, removed, unchanged, files }
 *          added などは各ファイルパスの配列、files は設定ファイルに記録する新しい files
 *
 * NOTE:
 *   - 編集や衝突の確認はしない（呼び出し側が findSyncConflicts() で確認してから呼ぶ）
 *   - 設定ファイルは書き込まない（呼び出し側が files を記録する）
 */
export const applySync = async ({ cwd, desiredFiles, recordedFiles }) => {
  const removed = Object.keys(recordedFiles)
    .filter((relPath) => !desiredFiles.has(relPath))
    .sort();
  for (const relPath of removed) {
    await rm(toAbsolute(cwd, relPath), { force: true });
  }

  const added = [];
  const updated = [];
  const unchanged = [];
  const files = {};
  for (const relPath of [...desiredFiles.keys()].sort()) {
    const content = desiredFiles.get(relPath);
    const path = toAbsolute(cwd, relPath);
    const current = await readTextIfExists(path);

    if (current === content) {
      unchanged.push(relPath);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
      (current === null ? added : updated).push(relPath);
    }
    files[relPath] = hashContent(content);
  }

  return { added, updated, removed, unchanged, files };
};
