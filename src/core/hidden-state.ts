import { Memo } from "../types";

export function getMemoStateKey(memo: Memo, sourcePath: string): string {
  return `${sourcePath}#${memo.id}`;
}

export function getMemoFirstLine(memo: Memo): string {
  const first = memo.content.trim();
  if (first) return first;
  for (let i = 1; i < memo.rawLines.length; i++) {
    const line = (memo.rawLines[i] ?? "").trim();
    if (line) return line;
  }
  return "(empty scrap)";
}
