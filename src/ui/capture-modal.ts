import { App, Modal, Notice, Platform } from "obsidian";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorState } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorView, placeholder as cmPlaceholder } from "@codemirror/view";
import type ScrapsPlugin from "../main";
import { MemoWriter } from "../core/memo-writer";
import { createMemoEditorExtensions } from "./editor-factory";

export class CaptureModal extends Modal {
  private readonly writer: MemoWriter;
  private readonly plugin: ScrapsPlugin;
  private editorView: EditorView | null = null;
  private submitted = false;

  constructor(app: App, writer: MemoWriter, plugin: ScrapsPlugin) {
    super(app);
    this.writer = writer;
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("scraps-capture-modal");

    if (Platform.isMobile) {
      this.modalEl.addClass("scraps-edit-modal");
      this.modalEl.querySelector(".modal-close-button")?.remove();
    }

    // Header: title + buttons on the same row
    const headerRow = contentEl.createDiv({ cls: "scraps-edit-header" });
    headerRow.createSpan({ text: "New scrap", cls: "scraps-edit-title" });
    const buttonGroup = headerRow.createDiv({ cls: "scraps-capture-buttons" });
    const cancelBtn = buttonGroup.createEl("button", { text: "Cancel" });
    const submitBtn = buttonGroup.createEl("button", {
      text: "Save",
      cls: "mod-cta",
    });

    const editorWrapper = contentEl.createDiv({
      cls: "scraps-capture-editor",
    });

    const draftListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        this.plugin.saveDraft({ captureModal: update.state.doc.toString() });
      }
    });

    const initialDoc = this.plugin.getDrafts().captureModal;
    const extensions = [...createMemoEditorExtensions(this.app), cmPlaceholder("Write a new scrap..."), draftListener];

    this.editorView = new EditorView({
      state: EditorState.create({ doc: initialDoc, extensions }),
      parent: editorWrapper,
    });
    this.editorView.focus();

    cancelBtn.addEventListener("click", () => {
      this.close();
    });
    submitBtn.addEventListener("click", () => {
      void this.submit();
    });

    this.scope.register(["Mod"], "Enter", () => {
      void this.submit();
      return false;
    });
  }

  onClose(): void {
    if (!this.submitted) {
      this.plugin.flushDrafts();
    }
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    if (!this.editorView) return;
    const text = this.editorView.state.doc.toString().trim();
    if (!text) return;
    try {
      await this.writer.appendMemo(text);
      this.submitted = true;
      this.plugin.clearDraft("captureModal");
      this.close();
    } catch (e: unknown) {
      console.error("Scraps: failed to save scrap", e);
      new Notice("Scraps: failed to save scrap");
    }
  }
}
