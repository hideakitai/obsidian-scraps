/**
 * Forwards vim-mode-change events from scraps' standalone CodeMirror editors
 * to Obsidian's workspace as "vim-mode-changed" events.
 *
 * This allows IME control plugins (e.g. obsidian-vim-im-control) that listen
 * on workspace events to handle mode changes from non-MarkdownView editors.
 */
import type { App } from "obsidian";
import type { Extension } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { ViewPlugin } from "@codemirror/view";
import { getCM } from "@replit/codemirror-vim";

export function vimModeForwarder(app: App): Extension {
  return ViewPlugin.define((view) => {
    const cm = getCM(view);
    if (!cm) return { destroy() {} };

    const onModeChange = (modeObj: { mode: string }): void => {
      (app.workspace as unknown as { trigger: (name: string, data: unknown) => void }).trigger(
        "vim-mode-changed",
        modeObj,
      );
    };

    cm.on("vim-mode-change", onModeChange);

    return {
      destroy() {
        cm.off("vim-mode-change", onModeChange);
      },
    };
  });
}
