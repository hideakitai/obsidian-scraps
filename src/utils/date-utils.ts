import { moment } from "obsidian";

export function getDateRange(days: number, referenceDate?: Date): string[] {
  const ref = referenceDate ?? new Date();
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(ref);
    d.setDate(d.getDate() - i);
    result.push(formatDateYMD(d));
  }
  return result;
}

export function formatDateYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dateToFilePath(date: string, folder: string): string {
  return `${folder}/${date}.md`;
}

export function formatDateForDisplay(date: string, format = "YYYY-MM-DD (ddd)"): string {
  return moment(date, "YYYY-MM-DD").format(format);
}

export function formatDateTimeForDisplay(date: string, time: string, dateFormat?: string): string {
  return `${formatDateForDisplay(date, dateFormat)} ${time}`;
}

export function getDateRangeBetween(from: string, to: string): string[] {
  const result: string[] = [];
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  const d = new Date(end);
  while (d >= start) {
    result.push(formatDateYMD(d));
    d.setDate(d.getDate() - 1);
  }
  return result;
}

export function getCurrentTime(format: "HH:mm:ss" | "HH:mm"): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  if (format === "HH:mm:ss") return `${hh}:${mm}:${ss}`;
  return `${hh}:${mm}`;
}

export function generateMemoId(date: string, time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${date}-${normalized.replace(/:/g, "-")}`;
}
