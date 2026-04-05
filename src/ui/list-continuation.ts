import type { Extension } from "@codemirror/state";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { EditorView, keymap } from "@codemirror/view";

const LIST_PREFIX_RE = /^(\s*)([-*+]|\d+\.)\s(\[[ x]\]\s)?/;

/**
 * CodeMirror 6 extension that continues markdown list prefixes on Enter.
 * When the current line is a list item with content, a new line with the
 * same prefix is inserted. When the line contains only the prefix (no
 * content), the prefix is removed to end the list.
 */
export function listContinuation(): Extension {
  return keymap.of([
    {
      key: "Enter",
      run(view: EditorView): boolean {
        const { state } = view;
        const { head } = state.selection.main;
        const line = state.doc.lineAt(head);
        const match = LIST_PREFIX_RE.exec(line.text);

        if (!match) {
          return false;
        }

        const fullPrefix = match[0];
        const indent = match[1] ?? "";
        const marker = match[2] ?? "";
        const checkbox = match[3] ?? "";

        // If the line is only the prefix (no content after it), remove the prefix
        if (line.text.length === fullPrefix.length) {
          view.dispatch({
            changes: { from: line.from, to: line.to, insert: "" },
          });
          return true;
        }

        // Build the next line's prefix — increment numbered lists
        let nextMarker = marker;
        if (/^\d+\.$/.test(marker)) {
          nextMarker = `${parseInt(marker, 10) + 1}.`;
        }

        // Reset checkbox to unchecked for continuation
        const nextCheckbox = checkbox ? "[ ] " : "";
        const insertion = `\n${indent}${nextMarker} ${nextCheckbox}`;

        view.dispatch({
          changes: { from: head, insert: insertion },
          selection: { anchor: head + insertion.length },
        });

        return true;
      },
    },
  ]);
}
