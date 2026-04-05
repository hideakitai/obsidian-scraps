import { App, PluginSettingTab, Setting } from "obsidian";
import type ScrapsPlugin from "./main";

export class ScrapsSettingTab extends PluginSettingTab {
  private readonly plugin: ScrapsPlugin;

  constructor(app: App, plugin: ScrapsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Section heading")
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- contains markdown heading syntax
      .setDesc("The heading line in daily notes where scraps are stored (e.g. ## Thino, ### Scraps)")
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- markdown heading syntax as placeholder
          .setPlaceholder("## Thino")
          .setValue(this.plugin.settings.sectionHeading)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              sectionHeading: value || "## Thino",
            };
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Display range (days)")
      .setDesc("Number of days to display initially")
      .addText((text) =>
        text
          .setPlaceholder("7")
          .setValue(String(this.plugin.settings.displayRange))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings = {
                ...this.plugin.settings,
                displayRange: num,
              };
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Time format")
      .setDesc("Timestamp format for new scraps")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("HH:mm:ss", "With seconds")
          .addOption("HH:mm", "Without seconds")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              timeFormat: value as "HH:mm:ss" | "HH:mm",
            };
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Sort order")
      .setDesc("Display order of scraps in the timeline")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("newest-first", "Newest first")
          .addOption("oldest-first", "Oldest first")
          .setValue(this.plugin.settings.sortOrder)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              sortOrder: value as "newest-first" | "oldest-first",
            };
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto create daily note")
      .setDesc("Automatically create today's daily note if it doesn't exist when adding a scrap")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoCreateNote).onChange(async (value) => {
          this.plugin.settings = {
            ...this.plugin.settings,
            autoCreateNote: value,
          };
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Confirm before delete")
      .setDesc("Show a confirmation dialog before deleting a scrap")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.confirmBeforeDelete).onChange(async (value) => {
          this.plugin.settings = {
            ...this.plugin.settings,
            confirmBeforeDelete: value,
          };
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Date display format")
      .setDesc(
        // eslint-disable-next-line obsidianmd/ui/sentence-case -- contains moment.js format tokens
        "Format for displaying dates in the timeline. Uses moment.js tokens (e.g. YYYY-MM-DD (ddd), MMM D YYYY)",
      )
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- moment.js format tokens as placeholder
          .setPlaceholder("YYYY-MM-DD (ddd)")
          .setValue(this.plugin.settings.dateDisplayFormat)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              dateDisplayFormat: value || "YYYY-MM-DD (ddd)",
            };
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Load more days")
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- quotes UI button label
      .setDesc("Number of additional days to load when clicking 'Load more'")
      .addText((text) =>
        text
          .setPlaceholder("7")
          .setValue(String(this.plugin.settings.loadMoreDays))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings = {
                ...this.plugin.settings,
                loadMoreDays: num,
              };
              await this.plugin.saveSettings();
            }
          }),
      );
  }
}
