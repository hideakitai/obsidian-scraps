import { App, Modal, Platform } from "obsidian";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorState } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorView } from "@codemirror/view";
import { createMemoEditorExtensions } from "./editor-factory";

export class EditModal extends Modal {
  private readonly initialText: string;
  private readonly onSave: (newText: string) => void;
  private editorView: EditorView | null = null;

  constructor(app: App, initialText: string, onSave: (newText: string) => void) {
    super(app);
    this.initialText = initialText;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("scraps-capture-modal", "scraps-edit-mode");

    if (Platform.isMobile) {
      this.modalEl.addClass("scraps-edit-modal");
      // Remove the default close button — Cancel serves the same purpose
      this.modalEl.querySelector(".modal-close-button")?.remove();
    }

    // Header: title + buttons on the same row
    const headerRow = contentEl.createDiv({ cls: "scraps-edit-header" });
    headerRow.createSpan({ text: "Edit scrap", cls: "scraps-edit-title" });
    const buttonGroup = headerRow.createDiv({ cls: "scraps-capture-buttons" });
    const cancelBtn = buttonGroup.createEl("button", { text: "Cancel" });
    const saveBtn = buttonGroup.createEl("button", {
      text: "Save",
      cls: "mod-cta",
    });

    const editorWrapper = contentEl.createDiv({
      cls: "scraps-capture-editor",
    });
    const extensions = createMemoEditorExtensions(this.app);

    this.editorView = new EditorView({
      state: EditorState.create({ doc: this.initialText, extensions }),
      parent: editorWrapper,
    });
    this.editorView.focus();

    saveBtn.addEventListener("click", () => {
      this.save();
    });
    cancelBtn.addEventListener("click", () => {
      this.close();
    });

    this.scope.register(["Mod"], "Enter", () => {
      this.save();
      return false;
    });
  }

  onClose(): void {
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
    this.contentEl.empty();
  }

  private save(): void {
    if (!this.editorView) return;
    const newText = this.editorView.state.doc.toString().trim();
    if (newText && newText !== this.initialText.trim()) {
      this.onSave(newText);
    }
    this.close();
  }
}
