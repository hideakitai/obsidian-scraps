/**
 * Bridges the bundled @replit/codemirror-vim register controller with
 * Obsidian's internal Vim register controller (window.CodeMirrorAdapter.Vim).
 *
 * This allows any plugin that monitors Obsidian's Vim registers (e.g. clipboard
 * sync plugins) to transparently work with scraps' standalone editors.
 */
import type { Extension } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { ViewPlugin } from "@codemirror/view";
import { Vim, getCM } from "@replit/codemirror-vim";

interface VimRegister {
  readonly keyBuffer: string[];
  setText(text?: string, linewise?: boolean, blockwise?: boolean): void;
}

interface VimLikeObject {
  getRegisterController(): {
    getRegister(name?: string): VimRegister;
  };
}

function getObsidianVim(): VimLikeObject | null {
  const adapter = (window as unknown as Record<string, unknown>)["CodeMirrorAdapter"];
  if (!adapter || typeof adapter !== "object") return null;
  const vimObj = (adapter as Record<string, unknown>)["Vim"];
  if (!vimObj || typeof vimObj !== "object" || !("getRegisterController" in vimObj)) return null;
  return vimObj as VimLikeObject;
}

// Shared across all scraps editor instances (one bundled Vim singleton)
let lastSyncedText = "";

function syncRegisters(): void {
  const obsidianVim = getObsidianVim();
  if (!obsidianVim) return;

  const scrapsRegister = Vim.getRegisterController().getRegister("yank");
  const obsidianRegister = obsidianVim.getRegisterController().getRegister("yank");

  const scrapsText = scrapsRegister.keyBuffer[0] ?? "";
  const obsidianText = obsidianRegister.keyBuffer[0] ?? "";

  if (scrapsText !== lastSyncedText && scrapsText !== obsidianText) {
    // Scraps register was modified (yank) → propagate to Obsidian
    obsidianRegister.setText(scrapsText);
    lastSyncedText = scrapsText;
  } else if (obsidianText !== lastSyncedText && obsidianText !== scrapsText) {
    // Obsidian register was modified (by clipboard sync plugin etc.) → propagate to scraps
    scrapsRegister.setText(obsidianText);
    lastSyncedText = obsidianText;
  }
}

export function vimRegisterBridge(): Extension {
  return ViewPlugin.define((view) => {
    const cm = getCM(view);
    if (!cm) return { destroy() {} };

    const handler = (): void => {
      syncRegisters();
    };

    view.dom.addEventListener("keyup", handler);
    view.dom.addEventListener("focusin", handler);

    return {
      destroy() {
        view.dom.removeEventListener("keyup", handler);
        view.dom.removeEventListener("focusin", handler);
      },
    };
  });
}
