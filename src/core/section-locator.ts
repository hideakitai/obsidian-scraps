import { CachedMetadata } from "obsidian";

export interface SectionRange {
  readonly startLine: number;
  readonly endLine: number;
}

export function findSectionRange(
  cache: CachedMetadata | null,
  sectionHeading: string,
  totalLines: number,
): SectionRange | null {
  if (!cache?.headings) return null;

  const match = sectionHeading.match(/^(#+)\s+(.*)/);
  const level = match ? match[1]!.length : 2;
  const headingText = match ? match[2]! : sectionHeading;

  const headingIndex = cache.headings.findIndex((h) => h.level === level && h.heading === headingText);
  if (headingIndex === -1) return null;

  const heading = cache.headings[headingIndex];
  if (!heading) return null;
  const startLine = heading.position.start.line;

  const nextHeading = cache.headings.slice(headingIndex + 1).find((h) => h.level <= level);
  const endLine = nextHeading ? nextHeading.position.start.line : totalLines;

  return { startLine, endLine };
}
