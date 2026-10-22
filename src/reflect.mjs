import { writeConfig } from "./config.mjs";
import { readPackageVersion } from "./modules.mjs";
import { buildRuleFiles } from "./rules.mjs";
import { syncDotFiles } from "./sync.mjs";

/**
 * @function 選択されたモジュールを対象リポジトリに反映し、設定ファイルを更新する
 *
 * @param options.cwd 対象リポジトリのルート
 * @param options.catalog loadCatalog() が返すカタログ
 * @param options.selectedIds 反映する core 以外のモジュール ID（カタログに存在すること）
 * @param options.recordedFiles 設定ファイルに記録済みの files（初回は {}）
 * @param options.force ローカル編集や未管理ファイルの衝突があっても上書きするか
 * @returns syncDotFiles() の戻り値。衝突がある場合は何も書き込まない
 */
export const reflectDotAgents = async ({ cwd, catalog, selectedIds, recordedFiles, force }) => {
  const byId = new Map(Object.values(catalog).flat().map((m) => [m.id, m]));
  const modules = [...catalog.core, ...selectedIds.map((id) => byId.get(id))];
  const version = await readPackageVersion();

  const result = await syncDotFiles({
    cwd,
    desiredFiles: await buildRuleFiles(modules, version),
    recordedFiles,
    force,
  });
  if (!result.ok) {
    return result;
  }

  await writeConfig(cwd, { version, modules: [...selectedIds].sort(), files: result.files });
  return result;
};
