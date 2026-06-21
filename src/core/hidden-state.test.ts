import { describe, it, expect } from "vitest";
import { Memo } from "../types";
import { getMemoFirstLine, getMemoStateKey } from "./hidden-state";

function makeMemo(overrides: Partial<Memo>): Memo {
  return {
    id: "2026-06-22-14-30-45",
    date: "2026-06-22",
    time: "14:30:45",
    timeNormalized: "14:30:45",
    content: "",
    rawLines: [],
    tags: [],
    ...overrides,
  };
}

describe("getMemoFirstLine", () => {
  it("returns the trimmed content when content is non-empty", () => {
    const memo = makeMemo({ content: "  hello world  " });
    expect(getMemoFirstLine(memo)).toBe("hello world");
  });

  it("returns the first non-empty continuation line (indentation stripped) when content is empty", () => {
    const memo = makeMemo({
      content: "",
      rawLines: ["- 14:30:45", "", "\t- first sub item", "\t- second sub item"],
    });
    expect(getMemoFirstLine(memo)).toBe("- first sub item");
  });

  it("returns \"(empty scrap)\" when all lines are empty", () => {
    const memo = makeMemo({ content: "", rawLines: ["- 14:30:45", "", "\t"] });
    expect(getMemoFirstLine(memo)).toBe("(empty scrap)");
  });

  it("strips deeper indentation from the first continuation line", () => {
    const memo = makeMemo({ content: "", rawLines: ["- 14:30:45", "\t\tnested item"] });
    expect(getMemoFirstLine(memo)).toBe("nested item");
  });

  it("falls through whitespace-only content to the continuation line", () => {
    const memo = makeMemo({ content: "   ", rawLines: ["- 14:30:45", "\tplain continuation"] });
    expect(getMemoFirstLine(memo)).toBe("plain continuation");
  });
});

describe("getMemoStateKey", () => {
  it("returns `${sourcePath}#${memo.id}`", () => {
    const memo = makeMemo({ id: "2026-06-22-14-30-45" });
    expect(getMemoStateKey(memo, "DailyNotes/2026-06-22.md")).toBe(
      "DailyNotes/2026-06-22.md#2026-06-22-14-30-45",
    );
  });
});
