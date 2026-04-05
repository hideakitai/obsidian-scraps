import { debounce, Debouncer, Platform, Plugin } from "obsidian";
import { DEFAULT_DRAFTS, DEFAULT_SETTINGS, DraftState, PluginData, ScrapsSettings } from "./types";
import { ScrapsSettingTab } from "./settings";
import { SCRAPS_VIEW_TYPE, ScrapsView } from "./ui/scraps-view";
import { CaptureModal } from "./ui/capture-modal";
import { MemoWriter } from "./core/memo-writer";

const DRAFT_DEBOUNCE_MS = 500;

export default class ScrapsPlugin extends Plugin {
  settings: ScrapsSettings = DEFAULT_SETTINGS;
  private drafts: DraftState = DEFAULT_DRAFTS;
  private readonly debouncedSavePluginData: Debouncer<[], void> = debounce(
    () => {
      void this.savePluginData();
    },
    DRAFT_DEBOUNCE_MS,
  );

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(SCRAPS_VIEW_TYPE, (leaf) => new ScrapsView(leaf, this));

    this.addRibbonIcon("message-square", "Open scraps", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-panel",
      name: "Open panel",
      callback: () => {
        void this.activateView("sidebar");
      },
    });

    this.addCommand({
      id: "open-panel-center",
      name: "Open panel in center",
      callback: () => {
        void this.activateView("center");
      },
    });

    this.addCommand({
      id: "capture-scraps",
      name: "Capture",
      callback: () => {
        const writer = new MemoWriter(
          this.app,
          () => this.settings,
          async (patch) => {
            this.settings = { ...this.settings, ...patch };
            await this.saveSettings();
          },
        );
        new CaptureModal(this.app, writer, this).open();
      },
    });

    this.addSettingTab(new ScrapsSettingTab(this.app, this));
  }

  onunload(): void {
    this.flushDrafts();
  }

  async loadSettings(): Promise<void> {
    const raw: unknown = await this.loadData();

    if (raw && typeof raw === "object" && "settings" in raw) {
      // New format: { settings, drafts }
      const data = raw as Partial<PluginData>;
      this.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
      this.drafts = { ...DEFAULT_DRAFTS, ...(data.drafts ?? {}) };
    } else {
      // Legacy flat format: settings at root level
      const legacy = (raw ?? {}) as Partial<ScrapsSettings>;
      this.settings = { ...DEFAULT_SETTINGS, ...legacy };
      this.drafts = { ...DEFAULT_DRAFTS };
    }

    // Migrate old sectionHeading format (without #)
    if (!this.settings.sectionHeading.startsWith("#")) {
      this.settings = {
        ...this.settings,
        sectionHeading: `## ${this.settings.sectionHeading}`,
      };
      await this.savePluginData();
    }
  }

  private async savePluginData(): Promise<void> {
    await this.saveData({ settings: this.settings, drafts: this.drafts });
  }

  async saveSettings(): Promise<void> {
    await this.savePluginData();
    this.refreshAllViews();
  }

  saveDraft(patch: Partial<DraftState>): void {
    this.drafts = { ...this.drafts, ...patch };
    this.debouncedSavePluginData();
  }

  getDrafts(): DraftState {
    return this.drafts;
  }

  clearDraft(key: keyof DraftState): void {
    if (key === "memoEdit") {
      this.drafts = { ...this.drafts, memoEdit: null };
    } else {
      this.drafts = { ...this.drafts, [key]: "" };
    }
    this.debouncedSavePluginData();
  }

  flushDrafts(): void {
    void this.savePluginData();
  }

  private refreshAllViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(SCRAPS_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof ScrapsView) {
        view.refreshTimeline();
      }
    }
  }

  private async activateView(
    location: "sidebar" | "center" = Platform.isMobile ? "center" : "sidebar",
  ): Promise<void> {
    const { workspace } = this.app;

    if (location === "center") {
      const leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: SCRAPS_VIEW_TYPE, active: true });
      await workspace.revealLeaf(leaf);
      return;
    }

    let leaf = workspace.getLeavesOfType(SCRAPS_VIEW_TYPE).find((l) => l.getRoot() === workspace.rightSplit);
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({ type: SCRAPS_VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }
}
