import { App, Component, MarkdownRenderer, Menu, Notice, Platform, Scope, setIcon } from "obsidian";
import { confirmDeleteWithOption } from "./delete-confirm-modal";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorState } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorView } from "@codemirror/view";
import { Memo } from "../types";
import { getMemoFirstLine } from "../core/hidden-state";
import { formatDateTimeForDisplay } from "../utils/date-utils";
import { createMemoEditorExtensions } from "./editor-factory";
import { EditModal } from "./edit-modal";

export interface MemoCardDraftCallbacks {
  readonly saveMemoEditDraft: (memoId: string, text: string) => void;
  readonly clearMemoEditDraft: () => void;
  readonly getMemoEditDraftMemoId: () => string | undefined;
  readonly getMemoEditDraftText: (memoId: string) => string | undefined;
  readonly flushDrafts: () => void;
}

export interface MemoCardCallbacks {
  readonly onDelete: (memo: Memo) => void;
  readonly onEdit: (memo: Memo, newText: string) => void;
  readonly onCopyLink: (memo: Memo) => Promise<boolean>;
  readonly getConfirmBeforeDelete: () => boolean;
  readonly setConfirmBeforeDelete: (value: boolean) => void;
  readonly isHidden: (memo: Memo) => boolean;
  readonly onToggleHidden: (memo: Memo) => void;
  readonly dateFormat?: string;
  readonly draft?: MemoCardDraftCallbacks;
}

function getMemoBodyText(memo: Memo): string {
  const bodyLines: string[] = [];
  if (memo.content) {
    bodyLines.push(memo.content);
  }
  let insideFence = false;
  for (let i = 1; i < memo.rawLines.length; i++) {
    const line = memo.rawLines[i];
    if (line !== undefined) {
      if (/^\t?```/.test(line)) insideFence = !insideFence;
      bodyLines.push(insideFence || /^\t?```/.test(line) ? line.replace(/^\t/, "") : line.replace(/^\t|^ {2,4}/, ""));
    }
  }
  return bodyLines.join("\n");
}

export function renderMemoCard(
  container: HTMLElement,
  memo: Memo,
  app: App,
  component: Component,
  sourcePath: string,
  callbacks: MemoCardCallbacks,
): HTMLElement {
  const card = container.createDiv({ cls: "scraps-memo-card" });

  // Header row: time + action buttons
  const headerEl = card.createDiv({ cls: "scraps-memo-header" });
  const timeEl = headerEl.createEl("span", { cls: "scraps-memo-time" });
  timeEl.textContent = formatDateTimeForDisplay(memo.date, memo.time, callbacks.dateFormat);

  const headerActionsEl = headerEl.createDiv({
    cls: "scraps-memo-header-actions",
  });

  const hidden = callbacks.isHidden(memo);
  if (hidden) card.addClass("is-hidden");

  const hideBtn = headerActionsEl.createEl("button", {
    cls: "scraps-memo-hide clickable-icon",
    attr: { "aria-label": hidden ? "Show scrap" : "Hide scrap" },
  });
  setIcon(hideBtn, hidden ? "eye" : "eye-off");
  hideBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    callbacks.onToggleHidden(memo);
  });

  if (hidden) {
    card.createDiv({ cls: "scraps-memo-collapsed", text: getMemoFirstLine(memo) });
    return card;
  }

  function handleCopy(): void {
    void navigator.clipboard
      .writeText(getMemoBodyText(memo).trim())
      .then(() => {
        new Notice("Copied to clipboard");
      })
      .catch(() => {
        new Notice("Failed to copy to clipboard");
      });
  }

  function handleCopyLink(): void {
    void callbacks.onCopyLink(memo);
  }

  function handleDelete(): void {
    if (!callbacks.getConfirmBeforeDelete()) {
      callbacks.onDelete(memo);
      return;
    }
    void confirmDeleteWithOption(app, "Delete this scrap?").then(({ confirmed, dontAskAgain }) => {
      if (confirmed) {
        if (dontAskAgain) {
          callbacks.setConfirmBeforeDelete(false);
        }
        callbacks.onDelete(memo);
      }
    });
  }

  if (Platform.isMobile) {
    const moreBtn = headerActionsEl.createEl("button", {
      cls: "scraps-memo-more clickable-icon",
    });
    setIcon(moreBtn, "more-horizontal");
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = new Menu();
      menu.addItem((item) => item.setTitle("Copy").setIcon("copy").onClick(handleCopy));
      menu.addItem((item) => item.setTitle("Copy link").setIcon("link").onClick(handleCopyLink));
      menu.addItem((item) => item.setTitle("Edit").setIcon("pencil").onClick(enterEditMode));
      menu.addItem((item) => item.setTitle("Delete").setIcon("trash-2").onClick(handleDelete));
      menu.showAtMouseEvent(e);
    });
  } else {
    const linkBtn = headerActionsEl.createEl("button", {
      cls: "scraps-memo-link clickable-icon",
    });
    setIcon(linkBtn, "link");
    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleCopyLink();
    });

    const copyBtn = headerActionsEl.createEl("button", {
      cls: "scraps-memo-copy clickable-icon",
    });
    setIcon(copyBtn, "copy");
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleCopy();
    });

    const editBtn = headerActionsEl.createEl("button", {
      cls: "scraps-memo-edit clickable-icon",
    });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      enterEditMode();
    });

    const deleteBtn = headerActionsEl.createEl("button", {
      cls: "scraps-memo-delete clickable-icon",
    });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDelete();
    });
  }

  // Body (preview mode)
  const bodyEl = card.createDiv({
    cls: "scraps-memo-body markdown-rendered markdown-preview-view",
  });

  const markdown = getMemoBodyText(memo);
  if (markdown.trim()) {
    MarkdownRenderer.render(app, markdown, bodyEl, sourcePath, component)
      .then(() => {
        bodyEl.querySelectorAll("ul:has(> .task-list-item)").forEach((ul) => {
          ul.addClass("contains-task-list");
        });
      })
      .catch((e: unknown) => {
        console.error("Scraps: failed to render scrap", e);
        bodyEl.textContent = memo.content;
      });
  }

  function enterEditMode(): void {
    // On mobile, use a Modal to avoid iOS WebView keyboard/scroll issues.
    if (Platform.isMobile) {
      new EditModal(app, markdown.trim(), (newText) => {
        callbacks.onEdit(memo, newText);
      }).open();
      return;
    }

    if (card.hasClass("is-editing")) return;
    card.addClass("is-editing");
    bodyEl.addClass("scraps-hidden");

    let editSubMode: "edit" | "preview" = "edit";
    let previewChild: Component | null = null;

    const editorWrapperEl = createDiv({
      cls: "scraps-memo-editor-wrapper",
    });
    bodyEl.after(editorWrapperEl);

    const editPreviewEl = createDiv({
      cls: "scraps-memo-edit-preview markdown-rendered markdown-preview-view scraps-hidden",
    });
    editorWrapperEl.after(editPreviewEl);

    const draftListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        callbacks.draft?.saveMemoEditDraft(memo.id, update.state.doc.toString());
      }
    });

    const draftText = callbacks.draft?.getMemoEditDraftText(memo.id);
    const initialDoc = draftText ?? markdown.trim();
    const extensions = [...createMemoEditorExtensions(app), draftListener];
    const editorView = new EditorView({
      state: EditorState.create({ doc: initialDoc, extensions }),
      parent: editorWrapperEl,
    });
    editorView.focus();

    const actionsEl = createDiv({ cls: "scraps-memo-edit-actions" });
    editPreviewEl.after(actionsEl);

    const toggleBtn = actionsEl.createEl("span", {
      text: "Edit",
      cls: "scraps-mode-badge",
    });
    const actionSpacer = actionsEl.createDiv({
      cls: "scraps-button-spacer",
    });
    const saveBtn = actionSpacer.createEl("button", {
      text: "Save",
      cls: "mod-cta",
    });
    const cancelBtn = actionSpacer.createEl("button", { text: "Cancel" });

    function switchToEdit(): void {
      editSubMode = "edit";
      editorWrapperEl.removeClass("scraps-hidden");
      editPreviewEl.addClass("scraps-hidden");
      toggleBtn.textContent = "Edit";
      toggleBtn.removeClass("is-preview-mode");
      editorView.focus();
    }

    function switchToPreview(): void {
      editSubMode = "preview";
      editorWrapperEl.addClass("scraps-hidden");
      editPreviewEl.removeClass("scraps-hidden");
      toggleBtn.textContent = "Preview";
      toggleBtn.addClass("is-preview-mode");
      renderEditPreview();
    }

    function renderEditPreview(): void {
      if (previewChild) {
        previewChild.unload();
        previewChild = null;
      }
      editPreviewEl.empty();
      const text = editorView.state.doc.toString();
      if (!text.trim()) {
        editPreviewEl.textContent = "(empty)";
        return;
      }
      previewChild = new Component();
      previewChild.load();
      MarkdownRenderer.render(app, text, editPreviewEl, sourcePath, previewChild)
        .then(() => {
          editPreviewEl.querySelectorAll("ul:has(> .task-list-item)").forEach((ul: Element) => {
            ul.addClass("contains-task-list");
          });
        })
        .catch(() => {
          editPreviewEl.textContent = text;
        });
    }

    toggleBtn.addEventListener("click", () => {
      if (editSubMode === "edit") {
        switchToPreview();
      } else {
        switchToEdit();
      }
    });

    // Register keybindings via Obsidian's Scope so they fire before
    // CodeMirror's event handler (same pattern as memo-input).
    const editScope = new Scope(app.scope);
    editScope.register(["Mod"], "Enter", () => {
      saveBtn.click();
      return false;
    });
    editScope.register(["Mod"], "e", () => {
      if (editSubMode === "edit") {
        switchToPreview();
      } else {
        switchToEdit();
      }
      return false;
    });
    editScope.register([], "Escape", () => {
      const vimEnabled = (app.vault as unknown as { getConfig: (key: string) => unknown }).getConfig("vimMode");
      if (vimEnabled) return true;
      cancelBtn.click();
      return false;
    });
    app.keymap.pushScope(editScope);

    function exitEditMode(): void {
      callbacks.draft?.flushDrafts();
      app.keymap.popScope(editScope);
      if (previewChild) {
        previewChild.unload();
      }
      editorView.destroy();
      editorWrapperEl.remove();
      editPreviewEl.remove();
      actionsEl.remove();
      bodyEl.removeClass("scraps-hidden");
      card.removeClass("is-editing");
    }

    saveBtn.addEventListener("click", () => {
      const newText = editorView.state.doc.toString().trim();
      callbacks.draft?.clearMemoEditDraft();
      exitEditMode();
      if (newText && newText !== markdown.trim()) {
        callbacks.onEdit(memo, newText);
      }
    });

    cancelBtn.addEventListener("click", () => {
      callbacks.draft?.clearMemoEditDraft();
      exitEditMode();
    });
  }

  // Auto-restore edit mode if a draft exists for this memo
  if (callbacks.draft?.getMemoEditDraftMemoId() === memo.id) {
    enterEditMode();
  }

  return card;
}
