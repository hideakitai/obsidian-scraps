import { App, Component, MarkdownRenderer, Notice, Scope } from "obsidian";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorState } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorView, placeholder } from "@codemirror/view";
import type ScrapsPlugin from "../main";
import { createMemoEditorExtensions } from "./editor-factory";

export interface MemoInputOptions {
  readonly app: App;
  readonly component: Component;
  readonly scope: Scope;
  readonly plugin: ScrapsPlugin;
  readonly onSubmit: (text: string) => Promise<void>;
}

export function renderMemoInput(container: HTMLElement, options: MemoInputOptions): { inputContainer: HTMLElement } {
  const inputContainer = container.createDiv({
    cls: "scraps-input-container",
  });

  let mode: "edit" | "preview" = "edit";
  let activeChild: Component | null = null;

  // Editor/Preview body
  const inputBodyEl = inputContainer.createDiv({ cls: "scraps-input-body" });

  const previewEl = inputBodyEl.createDiv({
    cls: "scraps-preview markdown-rendered markdown-preview-view scraps-hidden",
  });

  // Register keybindings via Obsidian's Scope so they fire before
  // the app-level keymap and the vim plugin's event handler.
  options.scope.register(["Mod"], "Enter", () => {
    void submit();
    return false;
  });
  options.scope.register(["Mod"], "e", () => {
    if (mode === "edit") {
      switchToPreview();
    } else {
      switchToEdit();
    }
    return false;
  });

  // CodeMirror editor — wrap in a container so we can reliably hide it
  // (CM6 manages classes/styles on editorView.dom internally).
  const editorWrapperEl = inputBodyEl.createDiv({
    cls: "scraps-editor-wrapper",
  });

  const draftListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      options.plugin.saveDraft({ memoInput: update.state.doc.toString() });
    }
  });

  const initialDoc = options.plugin.getDrafts().memoInput;
  const extensions = [...createMemoEditorExtensions(options.app), placeholder("Write a new scrap..."), draftListener];

  const editorView = new EditorView({
    state: EditorState.create({ doc: initialDoc, extensions }),
    parent: editorWrapperEl,
  });

  // Mode switching
  function switchToEdit(): void {
    mode = "edit";
    editorWrapperEl.removeClass("scraps-hidden");
    previewEl.addClass("scraps-hidden");
    toggleBtn.textContent = "Edit";
    toggleBtn.removeClass("is-preview-mode");
    editorView.focus();
  }

  function switchToPreview(): void {
    mode = "preview";
    editorWrapperEl.addClass("scraps-hidden");
    previewEl.removeClass("scraps-hidden");
    toggleBtn.textContent = "Preview";
    toggleBtn.addClass("is-preview-mode");
    renderPreview();
  }

  // Preview rendering
  function renderPreview(): void {
    if (activeChild) {
      activeChild.unload();
      activeChild = null;
    }
    previewEl.empty();
    const text = editorView.state.doc.toString();
    if (!text.trim()) {
      previewEl.textContent = "(empty)";
      return;
    }
    activeChild = new Component();
    activeChild.load();
    MarkdownRenderer.render(options.app, text, previewEl, "", activeChild)
      .then(() => {
        previewEl.querySelectorAll("ul:has(> .task-list-item)").forEach((ul) => {
          ul.addClass("contains-task-list");
        });
      })
      .catch(() => {
        previewEl.textContent = text;
      });
  }

  // Submit
  async function submit(): Promise<void> {
    const text = editorView.state.doc.toString().trim();
    if (!text) return;
    try {
      await options.onSubmit(text);
      options.plugin.clearDraft("memoInput");
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: "",
        },
      });
      if (mode === "preview") switchToEdit();
    } catch (e: unknown) {
      console.error("Scraps: failed to save scrap", e);
      new Notice("Scraps: failed to save scrap");
    }
  }

  // Button row
  const buttonRow = inputContainer.createDiv({ cls: "scraps-button-row" });

  // Mode badge (left side of button row)
  const toggleBtn = buttonRow.createEl("span", {
    text: "Edit",
    cls: "scraps-mode-badge",
  });
  toggleBtn.addEventListener("click", () => {
    if (mode === "edit") {
      switchToPreview();
    } else {
      switchToEdit();
    }
  });

  // Spacer pushes action buttons to the right
  buttonRow.createDiv({ cls: "scraps-button-spacer" });

  const submitBtn = buttonRow.createEl("button", {
    text: "Submit",
    cls: "scraps-submit-btn mod-cta",
  });
  submitBtn.addEventListener("click", () => {
    void submit();
  });

  // Cleanup — flush pending draft before destroying editor
  options.component.register(() => {
    options.plugin.flushDrafts();
    editorView.destroy();
    if (activeChild) {
      activeChild.unload();
    }
  });

  return { inputContainer };
}
