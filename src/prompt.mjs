import { confirm, intro, isCancel, multiselect, note } from "@clack/prompts";
import { SELECTABLE_CATEGORIES } from "./modules.mjs";

const toOptions = (modules) =>
  modules.map(({ name, title }) => ({ value: name, label: name, hint: title }));

const formatSummary = (selected) => {
  const lines = ["core（常に含まれる）"];
  for (const category of SELECTABLE_CATEGORIES) {
    if (selected[category].length > 0) {
      lines.push(`${category}: ${selected[category].join(", ")}`);
    }
  }
  return lines.join("\n");
};

/**
 * @function 反映する lang / stack を対話的に選ばせる
 *
 * @param options.catalog loadCatalog() が返すカタログ
 * @param options.detected 初期選択にする { lang, stack }（モジュール名の配列）
 * @returns 選択結果の { lang, stack }。キャンセルされた場合・確認で拒否された場合は null
 *
 * NOTE:
 *   - 何も選ばなくてもよい（その場合は core のみを反映する）
 */
export const promptSelection = async ({ catalog, detected }) => {
  intro("dot-agents init");

  const selected = {};
  for (const category of SELECTABLE_CATEGORIES) {
    const answer = await multiselect({
      message: `${category} を選んでください（スペースで選択、Enter で確定）`,
      options: toOptions(catalog[category]),
      initialValues: detected[category],
      required: false,
    });
    if (isCancel(answer)) {
      return null;
    }
    selected[category] = answer;
  }

  note(formatSummary(selected), "反映する内容");
  const isConfirmed = await confirm({ message: "この内容で反映しますか？", initialValue: true });
  if (isCancel(isConfirmed) || !isConfirmed) {
    return null;
  }
  return selected;
};
