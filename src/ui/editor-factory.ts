import { App, Platform } from "obsidian";

import type { Extension } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { drawSelection, EditorView } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { listContinuation } from "./list-continuation";
import { vimRegisterBridge } from "./vim-register-bridge";
import { vimModeForwarder } from "./vim-mode-forwarder";
import { vimVimrcLoader } from "./vim-vimrc-loader";

export function createMemoEditorExtensions(app: App): Extension[] {
  const extensions: Extension[] = [drawSelection(), EditorView.lineWrapping, listContinuation()];

  if (!Platform.isMobile && (app.vault as unknown as { getConfig: (key: string) => unknown }).getConfig("vimMode")) {
    extensions.push(vim());
    extensions.push(vimVimrcLoader(app));
    extensions.push(vimRegisterBridge());
    extensions.push(vimModeForwarder(app));
  }

  return extensions;
}
