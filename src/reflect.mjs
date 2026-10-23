import {
  AGENTS_MD_PATH,
  CLAUDE_MD_PATH,
  ensureClaudeMd,
  planAgentsMd,
  writeAgentsMd,
} from "./agents-md.mjs";
import { writeConfig } from "./config.mjs";
import { readPackageVersion } from "./package.mjs";
import { buildRuleFiles } from "./rules.mjs";
import { applySync, findSyncConflicts } from "./sync.mjs";

/**
 * @function 選択されたモジュールを対象リポジトリに反映し、設定ファイルを更新する
 *
 * @param options.cwd 対象リポジトリのルート
 * @param options.catalog loadCatalog() が返すカタログ
 * @param options.selectedIds 反映する core 以外のモジュール ID（カタログに存在すること）
 * @param options.recordedFiles 設定ファイルに記録済みの files（初回は {}）
 * @param options.recordedBlocks 設定ファイルに記録済みの blocks（初回は {}）
 * @param options.force ローカル編集や未管理ファイルの衝突があっても上書きするか
 * @returns 反映できない場合は { ok: false, edited, collisions, problems }（何も書き込まない）。
 *          反映した場合は { ok: true, added, updated, removed, unchanged, files, warnings }
 *
 * NOTE:
 *   - ルール・AGENTS.md・CLAUDE.md を反映し、AGENTS.md は管理ブロックのみを書き換える
 *   - problems: AGENTS.md のマーカーの不備。force でも反映しない
 *   - edited には、AGENTS.md の管理ブロックがローカルで編集されている場合の AGENTS.md も含む
 *   - warnings: 反映は成功したが、ユーザーが対処すべき事項
 */
export const reflectDotAgents = async ({
  cwd,
  catalog,
  selectedIds,
  recordedFiles,
  recordedBlocks,
  force,
}) => {
  const byId = new Map(Object.values(catalog).flat().map((m) => [m.id, m]));
  const modules = [...catalog.core, ...selectedIds.map((id) => byId.get(id))];
  const version = await readPackageVersion();
  const desiredFiles = await buildRuleFiles(modules, version);

  const agentsMd = await planAgentsMd({
    cwd,
    recordedBlockHash: recordedBlocks[AGENTS_MD_PATH],
  });
  if (agentsMd.problem) {
    return { ok: false, edited: [], collisions: [], problems: [agentsMd.problem] };
  }

  const { edited, collisions } = await findSyncConflicts({ cwd, desiredFiles, recordedFiles });
  if (agentsMd.isBlockEdited) {
    edited.push(AGENTS_MD_PATH);
    edited.sort();
  }
  if (!force && (edited.length > 0 || collisions.length > 0)) {
    return { ok: false, edited, collisions, problems: [] };
  }

  const result = await applySync({ cwd, desiredFiles, recordedFiles });
  result[await writeAgentsMd(cwd, agentsMd)].push(AGENTS_MD_PATH);
  const claudeMd = await ensureClaudeMd(cwd);
  if (claudeMd.created) {
    result.added.push(CLAUDE_MD_PATH);
  }
  for (const key of ["added", "updated", "unchanged"]) {
    result[key].sort();
  }

  await writeConfig(cwd, {
    version,
    modules: [...selectedIds].sort(),
    files: result.files,
    blocks: { [AGENTS_MD_PATH]: agentsMd.blockHash },
  });
  return { ok: true, ...result, warnings: claudeMd.warning ? [claudeMd.warning] : [] };
};
