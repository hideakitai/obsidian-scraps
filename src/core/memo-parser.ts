import { Memo } from "../types";
import { generateMemoId } from "../utils/date-utils";

const TIMESTAMP_RE = /^- (\d{2}:\d{2}(?::\d{2})?)\s?(.*)$/;
export const CODE_FENCE_RE = /^\t*```|^ {2,}```/;
export const TAB_INDENT_RE = /^\t/;
export const SPACE_INDENT_RE = /^ {2}/;
const TAG_RE = /#([^\s#]+)/g;

function extractTags(rawLines: string[]): readonly string[] {
  const tags = new Set<string>();
  for (const line of rawLines) {
    let match: RegExpExecArray | null;
    TAG_RE.lastIndex = 0;
    while ((match = TAG_RE.exec(line)) !== null) {
      if (match[1]) tags.add(match[1]);
    }
  }
  return [...tags];
}

export function parseMemos(lines: string[], date: string): Memo[] {
  const memos: Memo[] = [];
  let currentLines: string[] | null = null;
  let currentTime = "";
  let currentContent = "";
  let insideCodeFence = false;

  const finalizeMemo = (): void => {
    if (currentLines === null) return;
    const time = currentTime;
    const timeNormalized = time.length === 5 ? `${time}:00` : time;
    const id = generateMemoId(date, time);
    memos.push({
      id,
      date,
      time,
      timeNormalized,
      content: currentContent,
      rawLines: currentLines,
      tags: extractTags(currentLines),
    });
    currentLines = null;
  };

  for (const line of lines) {
    // Timestamp lines start at column 0 ("- HH:MM:SS ...") and can never
    // appear inside a tab/space-indented code fence.  Check timestamps
    // BEFORE the code-fence / insideCodeFence logic so that fence-parity
    // errors (e.g. consecutive ``` lines) are automatically recovered.
    const timestampMatch = line.match(TIMESTAMP_RE);
    if (timestampMatch) {
      insideCodeFence = false;
      finalizeMemo();
      currentTime = timestampMatch[1] ?? "";
      currentContent = (timestampMatch[2] ?? "").trim();
      currentLines = [line];
      if (/^```/.test(currentContent)) {
        insideCodeFence = true;
      }
      continue;
    }

    if (CODE_FENCE_RE.test(line)) {
      insideCodeFence = !insideCodeFence;
      if (currentLines !== null) currentLines.push(line);
      continue;
    }

    if (insideCodeFence) {
      if (currentLines !== null) currentLines.push(line);
      continue;
    }
    if (TAB_INDENT_RE.test(line) || SPACE_INDENT_RE.test(line)) {
      if (currentLines !== null) currentLines.push(line);
      continue;
    }

    if (line.trim() === "") {
      if (currentLines !== null) currentLines.push(line);
      continue;
    }

    // Non-indented, non-empty, non-timestamp: end of section
    break;
  }

  finalizeMemo();
  return memos;
}
