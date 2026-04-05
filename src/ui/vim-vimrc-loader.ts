/**
 * Reads the vault's vimrc file (the same one used by obsidian-vimrc-support)
 * and applies compatible commands to scraps' bundled @replit/codemirror-vim.
 *
 * Only pure vim commands are applied (nmap, map, set, unmap, etc.).
 * Obsidian-specific commands (exmap, obcommand references) are skipped.
 */
import type { App } from "obsidian";
import type { Extension } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { ViewPlugin } from "@codemirror/view";
import { Vim, getCM } from "@replit/codemirror-vim";

let vimrcApplied = false;
let exCommandsDefined = false;

/**
 * Register ex commands that vimrc-support defines via defineEx but are
 * not built into @replit/codemirror-vim (nunmap, vunmap, iunmap).
 */
function defineExCommands(): void {
  if (exCommandsDefined) return;
  exCommandsDefined = true;

  // Options that vimrc-support registers via defineOption
  Vim.defineOption("tabstop", 4, "number", [], (value, cm) => {
    if (value && cm) {
      cm.setOption("tabSize", value);
    }
  });
  Vim.defineOption("clipboard", "", "string", ["clip"], () => {
    // Clipboard sync is handled by vim-register-bridge — no-op here
  });

  // Ex commands that vimrc-support registers via defineEx
  Vim.defineEx("nunmap", "", (_cm, params) => {
    if (params.argString) Vim.unmap(params.argString.trim(), "normal");
  });
  Vim.defineEx("vunmap", "", (_cm, params) => {
    if (params.argString) Vim.unmap(params.argString.trim(), "visual");
  });
  Vim.defineEx("iunmap", "", (_cm, params) => {
    if (params.argString) Vim.unmap(params.argString.trim(), "insert");
  });
  Vim.defineEx("noremap", "", (_cm, params) => {
    if (params.args?.length) {
      Vim.noremap(params.args[0] ?? "", params.args.slice(1).join(" "), "");
    }
  });
}

async function getVimrcPath(app: App): Promise<string> {
  try {
    const configDir = app.vault.configDir;
    const raw = await app.vault.adapter.read(
      `${configDir}/plugins/obsidian-vimrc-support/data.json`,
    );
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object") {
      const fileName = (data as Record<string, unknown>)["vimrcFileName"];
      if (typeof fileName === "string" && fileName) {
        return fileName;
      }
    }
  } catch {
    // vimrc-support not installed or data.json missing
  }
  return `${app.vault.configDir}.vimrc`;
}

function parseVimrc(content: string): { exmapNames: ReadonlySet<string>; lines: readonly string[] } {
  const exmapNames = new Set<string>();
  const lines: string[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    // Skip empty lines and comments
    if (!line || line.startsWith('"')) continue;

    // Collect exmap definitions so we can skip commands that reference them
    const exmapMatch = /^exmap\s+(\S+)/.exec(line);
    if (exmapMatch?.[1]) {
      exmapNames.add(exmapMatch[1]);
      continue;
    }

    lines.push(line);
  }

  return { exmapNames, lines };
}

function isCompatibleCommand(line: string, exmapNames: ReadonlySet<string>): boolean {
  // Commands that reference exmap-defined names won't work
  for (const name of exmapNames) {
    if (line.includes(`:${name}`)) return false;
  }

  // Allow pure vim commands
  const compatiblePrefixes = [
    "nmap ", "vmap ", "imap ", "map ",
    "nnoremap ", "vnoremap ", "inoremap ", "noremap ",
    "nunmap ", "vunmap ", "iunmap ", "unmap ",
    "set ",
  ];
  return compatiblePrefixes.some((prefix) => line.startsWith(prefix));
}

export function vimVimrcLoader(app: App): Extension {
  return ViewPlugin.define((view) => {
    if (vimrcApplied) return { destroy() {} };

    const cm = getCM(view);
    if (!cm) return { destroy() {} };

    vimrcApplied = true;
    defineExCommands();

    void (async () => {
      try {
        const vimrcPath = await getVimrcPath(app);
        const content = await app.vault.adapter.read(vimrcPath);
        const { exmapNames, lines } = parseVimrc(content);

        for (const line of lines) {
          if (!isCompatibleCommand(line, exmapNames)) continue;
          try {
            Vim.handleEx(cm as never, line);
          } catch {
            // Unsupported command — skip silently
          }
        }
      } catch {
        // vimrc file not found — skip
      }
    })();

    return { destroy() {} };
  });
}
