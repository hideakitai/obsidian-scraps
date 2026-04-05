import { describe, it, expect } from "vitest";
import {
	getDateRange,
	dateToFilePath,
	formatDateForDisplay,
	getCurrentTime,
	generateMemoId,
} from "./date-utils";

describe("getDateRange", () => {
	it("returns correct number of dates for the given range", () => {
		const ref = new Date(2026, 2, 8); // 2026-03-08
		const result = getDateRange(7, ref);
		expect(result).toHaveLength(7);
	});

	it("returns dates in descending order (newest first)", () => {
		const ref = new Date(2026, 2, 8);
		const result = getDateRange(3, ref);
		expect(result).toEqual(["2026-03-08", "2026-03-07", "2026-03-06"]);
	});

	it("handles month boundary correctly", () => {
		const ref = new Date(2026, 2, 1); // 2026-03-01
		const result = getDateRange(3, ref);
		expect(result).toEqual(["2026-03-01", "2026-02-28", "2026-02-27"]);
	});

	it("handles year boundary correctly", () => {
		const ref = new Date(2026, 0, 1); // 2026-01-01
		const result = getDateRange(2, ref);
		expect(result).toEqual(["2026-01-01", "2025-12-31"]);
	});

	it("returns single date for range of 1", () => {
		const ref = new Date(2026, 2, 8);
		const result = getDateRange(1, ref);
		expect(result).toEqual(["2026-03-08"]);
	});
});

describe("dateToFilePath", () => {
	it("generates correct file path for daily note", () => {
		expect(dateToFilePath("2026-03-08", "DailyNotes")).toBe(
			"DailyNotes/2026-03-08.md",
		);
	});

	it("works with different folder names", () => {
		expect(dateToFilePath("2026-03-08", "Journal")).toBe(
			"Journal/2026-03-08.md",
		);
	});
});

describe("formatDateForDisplay", () => {
	it("includes the day of week abbreviation", () => {
		const result = formatDateForDisplay("2026-03-08");
		expect(result).toBe("2026-03-08 (Sun)");
	});

	it("formats Saturday correctly", () => {
		const result = formatDateForDisplay("2026-03-07");
		expect(result).toBe("2026-03-07 (Sat)");
	});
});

describe("getCurrentTime", () => {
	it("returns HH:mm:ss format with correct structure", () => {
		const result = getCurrentTime("HH:mm:ss");
		expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});

	it("returns HH:mm format with correct structure", () => {
		const result = getCurrentTime("HH:mm");
		expect(result).toMatch(/^\d{2}:\d{2}$/);
	});
});

describe("generateMemoId", () => {
	it("generates correct ID from date and HH:mm:ss time", () => {
		expect(generateMemoId("2026-03-08", "10:43:01")).toBe(
			"2026-03-08-10-43-01",
		);
	});

	it("normalizes HH:mm time to HH:mm:ss in the generated ID", () => {
		expect(generateMemoId("2026-03-08", "10:43")).toBe(
			"2026-03-08-10-43-00",
		);
	});
});
