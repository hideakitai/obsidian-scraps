import { describe, it, expect } from "vitest";
import { parseMemos } from "./memo-parser";

const DATE = "2026-03-08";

describe("parseMemos - Form A (HH:MM without seconds)", () => {
  it("parses a single memo in HH:MM format", () => {
    const lines = ["- 10:43 morning note"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "2026-03-08-10-43-00",
      date: DATE,
      time: "10:43",
      timeNormalized: "10:43:00",
      content: "morning note",
    });
  });

  it("normalizes HH:MM time to HH:MM:00 in timeNormalized", () => {
    const lines = ["- 09:05 quick note"];
    const result = parseMemos(lines, DATE);
    expect(result[0]?.timeNormalized).toBe("09:05:00");
  });
});

describe("parseMemos - Form B (HH:MM:SS with content and tab-indented sub-items)", () => {
  it("parses timestamp line content and includes sub-items in rawLines", () => {
    const lines = ["- 17:37:14 main content", "\t- sub-item one", "\t- sub-item two"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      time: "17:37:14",
      timeNormalized: "17:37:14",
      content: "main content",
    });
    expect(result[0]?.rawLines).toEqual(lines);
  });
});

describe("parseMemos - Form C (HH:MM:SS only, content on subsequent tab-indented lines)", () => {
  it("parses memo where content is entirely in tab-indented lines", () => {
    const lines = [
      "- 10:43:01",
      "\t- 各種同意書は3/18の健康診断で持っていく",
      "\t- 連絡先のやつ、電話番号など書いて次の時に出す",
      "\t- 災害共済給付制度の同意書",
    ];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "2026-03-08-10-43-01",
      date: DATE,
      time: "10:43:01",
      timeNormalized: "10:43:01",
      content: "",
    });
    expect(result[0]?.rawLines).toEqual(lines);
  });

  it("preserves empty lines within tab-indented memo content", () => {
    const lines = ["- 09:20:50", "\t浅野様", "", "\tNature 田井です。"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]?.rawLines).toEqual(lines);
  });
});

describe("parseMemos - Form D (HH:MM:SS with tab-indented code blocks)", () => {
  it("includes tab-indented code fence and contents in rawLines without splitting memo", () => {
    const lines = ["- 14:00:00", "\t```typescript", "\tconst x = 1;", "\t```"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]?.rawLines).toEqual(lines);
  });

  it("does not treat timestamp-like text inside code block as a new memo", () => {
    const lines = ["- 14:00:00", "\t```", "\t- 10:00:00 this looks like a memo but is inside code", "\t```"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
  });

  it("handles code fence opened on the timestamp line (plain ```)", () => {
    const lines = ["- 16:33:29 ```", "\tplain code block", "\t```", "- 16:33:42 ```txt", "\ttxt code block", "\t```"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(2);
    expect(result[0]?.content).toBe("```");
    expect(result[0]?.rawLines).toEqual(["- 16:33:29 ```", "\tplain code block", "\t```"]);
    expect(result[1]?.content).toBe("```txt");
    expect(result[1]?.rawLines).toEqual(["- 16:33:42 ```txt", "\ttxt code block", "\t```"]);
  });

  it("handles code fence on timestamp line followed by more memos", () => {
    const lines = ["- 10:00:00 ```python", "\tprint('hello')", "\t```", "- 11:00:00 normal memo"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(2);
    expect(result[0]?.content).toBe("```python");
    expect(result[1]?.content).toBe("normal memo");
  });
});

describe("parseMemos - multiple memos", () => {
  it("parses multiple sequential memos correctly", () => {
    const lines = ["- 10:00:00 first", "- 11:00:00 second", "- 12:00:00 third"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(3);
    expect(result[0]?.content).toBe("first");
    expect(result[1]?.content).toBe("second");
    expect(result[2]?.content).toBe("third");
  });

  it("assigns each memo only the lines that belong to it", () => {
    const lines = ["- 10:00:00 first", "\t- sub of first", "- 11:00:00 second", "\t- sub of second"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(2);
    expect(result[0]?.rawLines).toEqual(["- 10:00:00 first", "\t- sub of first"]);
    expect(result[1]?.rawLines).toEqual(["- 11:00:00 second", "\t- sub of second"]);
  });
});

describe("parseMemos - empty section", () => {
  it("returns empty array for empty input", () => {
    expect(parseMemos([], DATE)).toEqual([]);
  });

  it("returns empty array when section has no timestamp lines", () => {
    expect(parseMemos(["", ""], DATE)).toEqual([]);
  });
});

describe("parseMemos - section termination", () => {
  it("stops parsing at a non-indented non-timestamp line", () => {
    const lines = ["- 10:00:00 memo one", "## Next Section", "- 11:00:00 should not be parsed"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe("memo one");
  });
});

describe("parseMemos - spaces-only indentation", () => {
  it("treats 4-space-indented lines as sub-content", () => {
    const lines = ["- 17:37:14", "    ❯ content with 4-space indent", "      continuation line"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]?.rawLines).toHaveLength(3);
  });

  it("treats 2-space-indented lines as sub-content", () => {
    const lines = ["- 08:33:29", '  -. "$HOME/.local/share/../bin/env"'];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(1);
    expect(result[0]?.rawLines).toHaveLength(2);
  });
});

describe("parseMemos - code fence parity recovery", () => {
  it("recovers from consecutive empty code fences that desync insideCodeFence", () => {
    const lines = [
      "- 22:00:00 memo before fences",
      "\t```",
      "\tsome code",
      "\t```",
      "\t```",
      "- 23:45:20 memo after consecutive fences",
      "- 23:53:50 another memo",
    ];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(3);
    expect(result[0]?.content).toBe("memo before fences");
    expect(result[1]?.content).toBe("memo after consecutive fences");
    expect(result[2]?.content).toBe("another memo");
  });

  it("does not let orphaned code fence swallow subsequent memos", () => {
    const lines = ["- 10:00:00 first", "\t```", "- 11:00:00 second"];
    const result = parseMemos(lines, DATE);
    expect(result).toHaveLength(2);
    expect(result[1]?.content).toBe("second");
  });
});

describe("parseMemos - rawLines for reconstruction", () => {
  it("includes the timestamp line as first element in rawLines", () => {
    const lines = ["- 10:43:01 note"];
    const result = parseMemos(lines, DATE);
    expect(result[0]?.rawLines[0]).toBe("- 10:43:01 note");
  });
});
