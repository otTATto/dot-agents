# Tailwind CSS に関するルールや考え方

## 全般

- CSS は Tailwind CSS を使う
  - ただし、どうしても表現が難しい場合は Vanilla CSS を書いても構わないが、実装前に必ず承認を得る
- 4px スケール（Tailwind の spacing scale）を基本とする（例: `p-1`, `w-2`, `h-3`）
  - ただし、やむを得ない場合には `h-[10px]` などの任意の px 指定の書き方を許容する
