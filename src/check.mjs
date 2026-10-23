import { join } from "node:path";
import { AGENTS_MD_PATH, planAgentsMd } from "./agents-md.mjs";
import { readTextIfExists } from "./config.mjs";
import { findEditedFiles, findMissingFiles } from "./sync.mjs";

/**
 * @function 対象リポジトリの反映済みファイルに、ローカルでの編集・欠落・マーカーの不備がないか調べる（何も書き込まない）
 *
 * @param options.cwd 対象リポジトリのルート
 * @param options.config readConfig() が返す設定
 * @returns { edited, missing, problems }
 *   - edited: ローカルで編集されている管理ファイル（AGENTS.md の管理ブロックを含む）
 *   - missing: 記録済みなのにディスク上に無い管理ファイル（AGENTS.md を含む）
 *   - problems: AGENTS.md のマーカーの不備（ユーザー向けのメッセージ）
 */
export const findLocalProblems = async ({ cwd, config }) => {
  const edited = await findEditedFiles(cwd, config.files);
  const missing = findMissingFiles(cwd, config.files);
  const problems = [];

  const recordedBlockHash = config.blocks[AGENTS_MD_PATH];
  if (recordedBlockHash !== undefined && (await readTextIfExists(join(cwd, AGENTS_MD_PATH))) === null) {
    missing.push(AGENTS_MD_PATH);
  } else {
    const agentsMd = await planAgentsMd({ cwd, recordedBlockHash });
    if (agentsMd.problem) {
      problems.push(agentsMd.problem);
    } else if (agentsMd.isBlockEdited) {
      edited.push(AGENTS_MD_PATH);
    }
  }

  return { edited: edited.sort(), missing: missing.sort(), problems };
};
