import { describe, it, expect } from "vitest";
import { renderTemplateFallback } from "./template-render";

const stubFormat = (fmt: string): string => `[${fmt}]`;

describe("renderTemplateFallback", () => {
  it("substitutes a tp.file.creation_date token using the provided formatter", () => {
    const raw = 'created: <% tp.file.creation_date("YYYY-MM-DDTHH-MM-ss") %>';
    const { content, unresolved } = renderTemplateFallback(raw, stubFormat);
    expect(content).toBe("created: [YYYY-MM-DDTHH-MM-ss]");
    expect(unresolved).toEqual([]);
  });

  it("substitutes every creation_date occurrence (created and updated)", () => {
    const raw = [
      'created: <% tp.file.creation_date("YYYY-MM-DDTHH-MM-ss") %>',
      'updated: <% tp.file.creation_date("YYYY-MM-DDTHH-MM-ss") %>',
    ].join("\n");
    const { content } = renderTemplateFallback(raw, stubFormat);
    expect(content).toBe(
      "created: [YYYY-MM-DDTHH-MM-ss]\nupdated: [YYYY-MM-DDTHH-MM-ss]",
    );
  });

  it("uses Templater's default format when creation_date has no argument", () => {
    const raw = "x: <% tp.file.creation_date() %>";
    const { content } = renderTemplateFallback(raw, stubFormat);
    expect(content).toBe("x: [YYYY-MM-DD HH:mm]");
  });

  it("supports single-quoted format arguments", () => {
    const raw = "x: <% tp.file.creation_date('YYYY') %>";
    const { content } = renderTemplateFallback(raw, stubFormat);
    expect(content).toBe("x: [YYYY]");
  });

  it("leaves unknown Templater tokens in place and reports them as unresolved", () => {
    const raw = 'a: <% tp.date.now() %>\nb: <% tp.file.creation_date("YYYY") %>';
    const { content, unresolved } = renderTemplateFallback(raw, stubFormat);
    expect(content).toBe("a: <% tp.date.now() %>\nb: [YYYY]");
    expect(unresolved).toEqual(["<% tp.date.now() %>"]);
  });

  it("returns content unchanged with no unresolved tokens when there are none", () => {
    const raw = "# Heading\n\n## Scraps\n";
    const { content, unresolved } = renderTemplateFallback(raw, stubFormat);
    expect(content).toBe(raw);
    expect(unresolved).toEqual([]);
  });
});
