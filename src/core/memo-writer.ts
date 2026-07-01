import { App, EventRef, TFile, Notice, moment } from "obsidian";
import { Memo, ScrapsSettings } from "../types";
import { getCurrentTime, formatDateYMD, dateToFilePath } from "../utils/date-utils";
import { getDailyNotesConfig, getDailyNoteFile } from "./daily-notes";
import { renderTemplateFallback } from "./template-render";
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
      file = await this.createDailyNote(
        config.folder,
        today,
        settings.sectionHeading,
        config.template,
      );
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

  private async createDailyNote(
    folder: string,
    date: string,
    sectionHeading: string,
    templatePath: string,
  ): Promise<TFile> {
    const path = dateToFilePath(date, folder);

    // Templater auto-trigger on: creating the file fires the folder template
    // automatically, so an empty file plus a wait is enough.
    if (this.isTemplaterAutoEnabled()) {
      const file = await this.app.vault.create(path, "");
      await this.waitForTemplater(file);
      return file;
    }

    // Templater auto-trigger off (the vault's default): build a fully-structured
    // note from the daily-note template so a scrap-created note is identical to a
    // /daily-kickoff note, instead of a bare section-heading-only note. This must
    // not assume Templater is installed.
    const templateFile = this.resolveTemplateFile(templatePath);
    if (!templateFile) {
      // No template resolvable (unconfigured / missing file). Fail loudly rather
      // than silently producing a bare note that misses frontmatter and sections.
      new Notice(
        `Scraps: daily-note template not found${
          templatePath ? ` ("${templatePath}")` : ""
        }; created a minimal note`,
      );
      return await this.app.vault.create(path, `${sectionHeading}\n\n`);
    }

    const raw = await this.app.vault.read(templateFile);

    // Preferred path: let Templater process the template so every <% %>
    // expression resolves exactly as /daily-kickoff would.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const templater = this.getTemplaterPlugin();
    if (templater) {
      try {
        const file = await this.app.vault.create(path, raw);
        await this.overwriteViaTemplater(templater, file);
        return file;
      } catch (error) {
        // Templater is present but its (non-public) API changed or threw. Remove
        // the note we just created with unprocessed content so we never leave raw
        // <% %> markup behind, then fall through to the built-in fallback.
        const partial = this.app.vault.getAbstractFileByPath(path);
        if (partial instanceof TFile) await this.app.fileManager.trashFile(partial);
        console.error("Scraps: Templater template rendering failed", error);
        new Notice("Scraps: template rendering failed; used built-in fallback");
      }
    }

    // Templater absent (or the Templater path above failed): substitute the
    // template's date tokens ourselves. moment().format mirrors Templater's
    // tp.file.creation_date so the output matches a Templater-rendered note.
    const { content, unresolved } = renderTemplateFallback(raw, (fmt) => moment().format(fmt));
    if (unresolved.length > 0) {
      new Notice(
        `Scraps: ${unresolved.length} template token(s) could not be resolved; note still contains <% %> markup`,
      );
    }
    return await this.app.vault.create(path, content);
  }

  private resolveTemplateFile(templatePath: string): TFile | null {
    if (!templatePath) return null;
    // Obsidian's daily-note settings store the template path without ".md".
    const normalized = templatePath.endsWith(".md") ? templatePath : `${templatePath}.md`;
    const file = this.app.vault.getAbstractFileByPath(normalized);
    return file instanceof TFile ? file : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getTemplaterPlugin(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return (this.app as any).plugins?.getPlugin?.("templater-obsidian") ?? null;
  }

  private isTemplaterAutoEnabled(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const templater = this.getTemplaterPlugin();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return !!templater?.settings?.trigger_on_file_creation;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async overwriteViaTemplater(templater: any, file: TFile): Promise<void> {
    // Templater exposes its engine at `.templater`; overwrite_file_commands
    // processes the <% %> commands already present in `file` in place (the same
    // batch path Templater uses for its folder-template-on-create event).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await templater.templater.overwrite_file_commands(file);
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
