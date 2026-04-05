import { App, EventRef, TFile, Notice } from "obsidian";
import { Memo, ScrapsSettings } from "../types";
import { getCurrentTime, formatDateYMD, dateToFilePath } from "../utils/date-utils";
import { getDailyNotesConfig, getDailyNoteFile } from "./daily-notes";
import { confirm } from "../ui/confirm-modal";
import { CODE_FENCE_RE, TAB_INDENT_RE, SPACE_INDENT_RE } from "./memo-parser";

export class MemoWriter {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => ScrapsSettings,
    private readonly saveSettings: (patch: Partial<ScrapsSettings>) => Promise<void>,
  ) {}

  async appendMemo(text: string): Promise<void> {
    const settings = this.getSettings();
    const config = getDailyNotesConfig(this.app);
    const today = formatDateYMD(new Date());
    let file = getDailyNoteFile(this.app, config.folder, today);

    if (!file) {
      if (!settings.autoCreateNote) {
        const enableAutoCreate = await confirm(
          this.app,
          "Today's daily note doesn't exist. Enable auto-create daily note?",
          "Yes",
          "No",
        );

        if (enableAutoCreate) {
          await this.saveSettings({ autoCreateNote: true });
        } else {
          const copyToClipboard = await confirm(this.app, "Copy scrap to clipboard?", "Copy", "Cancel");
          if (copyToClipboard) {
            await navigator.clipboard.writeText(text);
            new Notice("Scraps: copied to clipboard");
          }
          return;
        }
      }
      file = await this.createDailyNote(config.folder, today, settings.sectionHeading);
    }

    const time = getCurrentTime(settings.timeFormat);
    const textLines = text.split("\n");
    const firstLine = textLines[0] ?? "";
    const rest = textLines.slice(1).map((l) => `\t${l}`);
    const memoLine = [`- ${time} ${firstLine}`, ...rest].join("\n");

    await this.app.vault.process(file, (content) => {
      return this.insertMemo(content, memoLine, settings.sectionHeading);
    });
  }

  async ensureBlockId(memo: Memo): Promise<{ blockId: string; fileBasename: string } | null> {
    const config = getDailyNotesConfig(this.app);
    const file = getDailyNoteFile(this.app, config.folder, memo.date);
    if (!file) return null;

    const fileBasename = file.basename;
    let blockId = "";
    let found = false;

    await this.app.vault.process(file, (content) => {
      const lines = content.split("\n");
      const startIdx = this.findMemoStartLine(lines, memo);
      if (startIdx === -1) return content;

      found = true;
      const count = this.countMemoLines(lines, startIdx);

      // Check all memo lines for an existing block ID
      for (let i = startIdx; i < startIdx + count; i++) {
        const existingMatch = / \^([\w-]+)$/.exec(lines[i] ?? "");
        if (existingMatch) {
          blockId = existingMatch[1]!;
          return content;
        }
      }

      blockId = memo.timeNormalized.replace(/:/g, "-");
      const firstLine = lines[startIdx] ?? "";

      // If timestamp line contains a code fence opening, add block ID
      // as a new continuation line after the memo to avoid breaking the fence
      if (/```/.test(firstLine)) {
        const insertIdx = startIdx + count;
        lines.splice(insertIdx, 0, `\t^${blockId}`);
      } else {
        lines[startIdx] = `${firstLine} ^${blockId}`;
      }
      return lines.join("\n");
    });

    if (!found) return null;
    return { blockId, fileBasename };
  }

  async deleteMemo(memo: Memo): Promise<void> {
    const config = getDailyNotesConfig(this.app);
    const file = getDailyNoteFile(this.app, config.folder, memo.date);
    if (!file) return;

    await this.app.vault.process(file, (content) => {
      const lines = content.split("\n");
      const startIdx = this.findMemoStartLine(lines, memo);
      if (startIdx === -1) return content;

      const count = this.countMemoLines(lines, startIdx);
      lines.splice(startIdx, count);
      return lines.join("\n");
    });
  }

  async updateMemo(memo: Memo, newText: string): Promise<void> {
    const config = getDailyNotesConfig(this.app);
    const file = getDailyNoteFile(this.app, config.folder, memo.date);
    if (!file) return;

    const textLines = newText.split("\n");
    const firstLine = textLines[0] ?? "";
    const rest = textLines.slice(1).map((l) => `\t${l}`);
    const newMemoLines = [`- ${memo.time} ${firstLine}`, ...rest];

    await this.app.vault.process(file, (content) => {
      const lines = content.split("\n");
      const startIdx = this.findMemoStartLine(lines, memo);
      if (startIdx === -1) return content;

      const count = this.countMemoLines(lines, startIdx);
      lines.splice(startIdx, count, ...newMemoLines);
      return lines.join("\n");
    });
  }

  private findMemoStartLine(lines: string[], memo: Memo): number {
    const rawLines = memo.rawLines;
    if (rawLines.length === 0) return -1;
    const firstRaw = rawLines[0]!;
    for (let i = 0; i <= lines.length - rawLines.length; i++) {
      if (lines[i] !== firstRaw) continue;
      let match = true;
      for (let j = 1; j < rawLines.length; j++) {
        if (lines[i + j] !== rawLines[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  private countMemoLines(lines: string[], startIdx: number): number {
    // Count from startIdx: first line + all continuation lines (tab/space-indented, blank, or code fence)
    let count = 1;
    let insideFence = false;
    const firstLine = lines[startIdx] ?? "";
    if (/^- \d{2}:\d{2}(?::\d{2})?\s.*```/.test(firstLine)) {
      insideFence = true;
    }

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) break;

      if (CODE_FENCE_RE.test(line)) {
        insideFence = !insideFence;
        count++;
        continue;
      }
      if (insideFence) {
        count++;
        continue;
      }
      if (TAB_INDENT_RE.test(line) || SPACE_INDENT_RE.test(line) || line.trim() === "") {
        count++;
        continue;
      }
      break;
    }

    // Trim trailing blank lines
    while (count > 1) {
      const lastLine = lines[startIdx + count - 1];
      if (lastLine !== undefined && lastLine.trim() === "") {
        count--;
      } else {
        break;
      }
    }

    return count;
  }

  private insertMemo(content: string, memoLine: string, sectionHeading: string): string {
    const lines = content.split("\n");
    const headingPattern = sectionHeading;
    const headingIndex = lines.findIndex((l) => l.trim() === headingPattern);

    if (headingIndex === -1) {
      const trimmed = content.trimEnd();
      return `${trimmed}\n\n${sectionHeading}\n\n${memoLine}\n`;
    }

    // Find end of section: next heading at same or higher level, or EOF
    const level = (sectionHeading.match(/^(#+)\s/) ?? ["", "##"])[1]!.length;
    const headingRe = new RegExp(`^#{1,${level}}\\s`);

    let insertIndex = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined && headingRe.test(line)) {
        insertIndex = i;
        break;
      }
    }

    // Find last non-empty line in the section
    let insertAt = insertIndex;
    while (insertAt > headingIndex + 1 && (lines[insertAt - 1]?.trim() ?? "") === "") {
      insertAt--;
    }

    if (insertAt === headingIndex + 1) {
      // Section is empty (heading + blank lines only), skip blanks and insert
      let firstContentIdx = headingIndex + 1;
      while (firstContentIdx < insertIndex && (lines[firstContentIdx]?.trim() ?? "") === "") {
        firstContentIdx++;
      }
      if (firstContentIdx === insertIndex) {
        // Entirely empty section
        lines.splice(headingIndex + 1, 0, "", memoLine);
        return lines.join("\n");
      }
    }

    // Append after the last content line in the section
    lines.splice(insertAt + 1, 0, memoLine);

    // Ensure blank line before next heading if needed
    const afterInsert = insertAt + 2;
    if (
      insertIndex < lines.length &&
      afterInsert < lines.length &&
      (lines[afterInsert]?.trim() ?? "") !== "" &&
      headingRe.test(lines[afterInsert] ?? "")
    ) {
      lines.splice(afterInsert, 0, "");
    }

    return lines.join("\n");
  }

  private async createDailyNote(folder: string, date: string, sectionHeading: string): Promise<TFile> {
    const path = dateToFilePath(date, folder);

    if (this.isTemplaterAutoEnabled()) {
      const file = await this.app.vault.create(path, "");
      await this.waitForTemplater(file);
      return file;
    }

    return await this.app.vault.create(path, `${sectionHeading}\n\n`);
  }

  private isTemplaterAutoEnabled(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const templater = (this.app as any).plugins?.getPlugin?.("templater-obsidian");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return !!templater?.settings?.trigger_on_file_creation;
  }

  private waitForTemplater(file: TFile): Promise<void> {
    const TIMEOUT_MS = 5000;
    return new Promise<void>((resolve) => {
      const ref: EventRef = this.app.vault.on("modify", (modified) => {
        if (modified.path === file.path) {
          this.app.vault.offref(ref);
          clearTimeout(timer);
          resolve();
        }
      });
      const timer = setTimeout(() => {
        this.app.vault.offref(ref);
        resolve();
      }, TIMEOUT_MS);
    });
  }
}
