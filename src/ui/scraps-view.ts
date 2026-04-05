import { debounce, ItemView, Notice, Platform, Scope, TFile, WorkspaceLeaf } from "obsidian";
import type ScrapsPlugin from "../main";
import { Memo } from "../types";
import { dateToFilePath, formatDateForDisplay, getDateRange, getDateRangeBetween } from "../utils/date-utils";
import { parseMemos } from "../core/memo-parser";
import { findSectionRange } from "../core/section-locator";
import { getDailyNoteFile, getDailyNotesConfig } from "../core/daily-notes";
import { MemoWriter } from "../core/memo-writer";
import { type MemoCardCallbacks, type MemoCardDraftCallbacks, renderMemoCard } from "./memo-card";
import { renderMemoInput } from "./memo-input";
import { type FilterBarElements, renderFilterBar } from "./filter-bar";
import { CaptureModal } from "./capture-modal";

export const SCRAPS_VIEW_TYPE = "scraps-view";

const INDEX_BATCH_SIZE = 50;

export class ScrapsView extends ItemView {
  private readonly plugin: ScrapsPlugin;
  private readonly memos: Map<string, Memo> = new Map();
  private loadedDays = 0;
  private timelineEl!: HTMLElement;
  private loadMoreBtn!: HTMLElement;
  private readonly writer: MemoWriter;
  private dailyNotesFolder = "";
  private searchQuery = "";
  private searchResults: Memo[] | null = null;
  private memoIndex: Memo[] | null = null;
  private dateFrom = "";
  private dateTo = "";
  private filterBar!: FilterBarElements;
  constructor(leaf: WorkspaceLeaf, plugin: ScrapsPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.writer = new MemoWriter(
      this.plugin.app,
      () => this.plugin.settings,
      async (patch) => {
        this.plugin.settings = { ...this.plugin.settings, ...patch };
        await this.plugin.saveSettings();
      },
    );
    this.scope = new Scope(this.app.scope);
  }

  getViewType(): string {
    return SCRAPS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Scraps";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("scraps-container");

    this.dailyNotesFolder = getDailyNotesConfig(this.app).folder;

    if (Platform.isMobile) {
      // On mobile, open CaptureModal instead of inline editor
      // to avoid the iOS WebView keyboard/scroll black zone issue.
      const inputTrigger = contentEl.createEl("button", {
        cls: "scraps-new-scrap-btn mod-cta",
        // eslint-disable-next-line obsidianmd/ui/sentence-case -- "+" prefix triggers false positive
        text: "+ New scrap",
      });
      inputTrigger.addEventListener("click", () => {
        new CaptureModal(this.app, this.writer, this.plugin).open();
      });
    } else {
      renderMemoInput(contentEl, {
        app: this.app,
        component: this,
        scope: this.scope!,
        plugin: this.plugin,
        onSubmit: async (text) => {
          await this.writer.appendMemo(text);
          await this.reload();
        },
      });
    }

    this.filterBar = renderFilterBar(
      contentEl,
      {
        onSearchChange: debounce(
          (query: string) => {
            this.searchQuery = query;
            if (query.trim().length === 0) {
              this.searchResults = null;
              this.renderTimeline();
            } else {
              this.searchMemoIndex(query);
            }
          },
          500,
          true,
        ),
        onDateRangeChange: (from, to) => {
          this.dateFrom = from;
          this.dateTo = to;
          if (from && to) {
            void this.reloadDateRange(from, to);
          } else {
            void this.reload();
          }
        },
      },
      this.app,
    );

    this.timelineEl = contentEl.createDiv({ cls: "scraps-timeline" });

    this.loadMoreBtn = contentEl.createEl("button", {
      text: "Load more...",
      cls: "scraps-load-more mod-cta",
    });
    this.loadMoreBtn.addEventListener("click", () => {
      void this.loadMore();
    });

    await this.loadMemos(this.plugin.settings.displayRange);
    this.renderTimeline();

    // Build memo index in the background (non-blocking)
    void this.buildMemoIndex();

    const debouncedHandler = debounce(
      (file: TFile) => {
        if (file.path.startsWith(this.dailyNotesFolder + "/")) {
          void this.onDailyNoteChanged(file);
        }
      },
      500,
      true,
    );

    this.registerEvent(this.app.metadataCache.on("changed", debouncedHandler));
  }

  async onClose(): Promise<void> {
    this.plugin.flushDrafts();
    this.contentEl.empty();
  }

  refreshTimeline(): void {
    this.renderTimeline();
  }

  private async reload(): Promise<void> {
    this.memos.clear();
    this.memoIndex = null;
    await this.loadMemos(this.loadedDays || this.plugin.settings.displayRange);
    this.renderTimeline();
    void this.buildMemoIndex();
  }

  private async reloadDateRange(from: string, to: string): Promise<void> {
    this.memos.clear();
    const dates = getDateRangeBetween(from, to);
    await this.parseAndStoreMemos(dates);
    this.renderTimeline();
  }

  private async loadMore(): Promise<void> {
    const scrollTop = this.timelineEl.scrollTop;
    const additionalDays = this.plugin.settings.loadMoreDays;
    await this.loadMemos(additionalDays, this.loadedDays);
    this.renderTimeline();
    this.timelineEl.scrollTop = scrollTop;
  }

  private async loadMemos(days: number, offset = 0): Promise<void> {
    const dates = getDateRange(days + offset).slice(offset);
    this.loadedDays = days + offset;
    await this.parseAndStoreMemos(dates);
  }

  private async parseSingleFile(file: TFile): Promise<Memo[]> {
    const cache = this.app.metadataCache.getFileCache(file);
    const content = await this.app.vault.cachedRead(file);
    const allLines = content.split("\n");
    const range = findSectionRange(cache, this.plugin.settings.sectionHeading, allLines.length);
    if (!range) return [];

    const sectionLines = allLines.slice(range.startLine + 1, range.endLine);
    const firstNonEmpty = sectionLines.findIndex((l) => l.trim() !== "");
    const trimmedLines = firstNonEmpty >= 0 ? sectionLines.slice(firstNonEmpty) : [];
    return parseMemos(trimmedLines, file.basename);
  }

  private async parseAndStoreMemos(dates: string[]): Promise<void> {
    const fileDates: { file: TFile; date: string }[] = [];
    for (const date of dates) {
      const file = getDailyNoteFile(this.app, this.dailyNotesFolder, date);
      if (file) fileDates.push({ file, date });
    }

    const results = await Promise.all(fileDates.map(({ file }) => this.parseSingleFile(file)));

    for (const memos of results) {
      for (const memo of memos) {
        this.memos.set(memo.id, memo);
      }
    }
  }

  private async buildMemoIndex(): Promise<void> {
    const allFiles = this.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(this.dailyNotesFolder + "/") && f.extension === "md");

    const index: Memo[] = [];

    for (let i = 0; i < allFiles.length; i += INDEX_BATCH_SIZE) {
      const batch = allFiles.slice(i, i + INDEX_BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((file) => this.parseSingleFile(file)));
      for (const memos of batchResults) {
        index.push(...memos);
      }
      // Yield to main thread between batches so UI stays responsive
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    this.memoIndex = index;
  }

  private searchMemoIndex(query: string): void {
    const index = this.memoIndex;
    if (!index) return;

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);
    if (keywords.length === 0) {
      this.searchResults = null;
    } else {
      this.searchResults = index.filter((memo) => {
        const text = memo.rawLines.join("\n").toLowerCase();
        return keywords.every((kw) => text.includes(kw));
      });
    }
    this.renderTimeline();
  }

  private async onDailyNoteChanged(file: TFile): Promise<void> {
    // Update memo index if built
    if (this.memoIndex) {
      const date = file.basename;
      this.memoIndex = this.memoIndex.filter((m) => m.date !== date);
      const newMemos = await this.parseSingleFile(file);
      this.memoIndex.push(...newMemos);
    }

    await this.reload();
  }

  private renderTimeline(): void {
    this.timelineEl.empty();

    const allMemos = this.searchResults !== null ? this.searchResults : [...this.memos.values()];
    const direction = this.plugin.settings.sortOrder === "oldest-first" ? 1 : -1;
    allMemos.sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date) * direction;
      if (dateComp !== 0) return dateComp;
      return a.timeNormalized.localeCompare(b.timeNormalized) * direction;
    });

    // When searchResults is set, memos are already filtered by searchMemoIndex
    const filtered =
      this.searchResults !== null
        ? allMemos
        : allMemos.filter((memo) => {
            const keywords = this.searchQuery
              .toLowerCase()
              .split(/\s+/)
              .filter((k) => k.length > 0);
            if (keywords.length === 0) return true;
            const text = memo.rawLines.join("\n").toLowerCase();
            return keywords.every((kw) => text.includes(kw));
          });

    // Collect unique tags from all memos (not just filtered)
    const tagCounts = new Map<string, number>();
    for (const memo of allMemos) {
      for (const tag of memo.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
    this.filterBar.updateAvailableTags(sortedTags);

    const draftCallbacks: MemoCardDraftCallbacks = {
      saveMemoEditDraft: (memoId, text) => {
        this.plugin.saveDraft({ memoEdit: { memoId, text } });
      },
      clearMemoEditDraft: () => {
        this.plugin.clearDraft("memoEdit");
      },
      getMemoEditDraftMemoId: () => this.plugin.getDrafts().memoEdit?.memoId,
      getMemoEditDraftText: (memoId) => {
        const draft = this.plugin.getDrafts().memoEdit;
        return draft?.memoId === memoId ? draft.text : undefined;
      },
      flushDrafts: () => {
        this.plugin.flushDrafts();
      },
    };

    const callbacks: MemoCardCallbacks = {
      onDelete: (m) => {
        void this.writer
          .deleteMemo(m)
          .then(() => this.reload())
          .catch((e: unknown) => {
            console.error("Scraps: failed to delete scrap", e);
            new Notice("Scraps: failed to delete scrap");
          });
      },
      onCopyLink: async (m): Promise<boolean> => {
        const result = await this.writer.ensureBlockId(m);
        if (!result) {
          new Notice("Failed to copy link");
          return false;
        }
        const link = `[[${result.fileBasename}#^${result.blockId}]]`;
        await navigator.clipboard.writeText(link);
        new Notice("Link copied");
        await this.reload();
        return true;
      },
      onEdit: (m, newText) => {
        void this.writer
          .updateMemo(m, newText)
          .then(() => this.reload())
          .catch((e: unknown) => {
            console.error("Scraps: failed to update scrap", e);
            new Notice("Scraps: failed to update scrap");
          });
      },
      getConfirmBeforeDelete: () => this.plugin.settings.confirmBeforeDelete,
      setConfirmBeforeDelete: (value: boolean) => {
        this.plugin.settings = {
          ...this.plugin.settings,
          confirmBeforeDelete: value,
        };
        void this.plugin.saveSettings();
      },
      dateFormat: this.plugin.settings.dateDisplayFormat,
      draft: draftCallbacks,
    };

    let lastDate = "";
    for (const memo of filtered) {
      if (memo.date !== lastDate) {
        lastDate = memo.date;
        this.timelineEl.createDiv({
          cls: "scraps-date-header",
          text: formatDateForDisplay(memo.date, this.plugin.settings.dateDisplayFormat),
        });
      }
      const sourcePath = dateToFilePath(memo.date, this.dailyNotesFolder);
      renderMemoCard(this.timelineEl, memo, this.app, this, sourcePath, callbacks);
    }

    const hasDateRange = this.dateFrom && this.dateTo;
    const isSearching = this.searchResults !== null;
    if (filtered.length > 0 && !hasDateRange && !isSearching) {
      this.timelineEl.appendChild(this.loadMoreBtn);
    }
  }
}
