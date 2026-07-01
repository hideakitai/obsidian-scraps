/**
 * Renders a daily-note template without Templater by substituting the only
 * dynamic tokens the daily-note template uses: `tp.file.creation_date(...)`.
 *
 * This is the Templater-absent fallback for scrap-triggered daily-note
 * creation. When Templater is installed the caller lets it process the template
 * so every `<% %>` expression resolves; this path covers the case where
 * Templater is not available. Date formatting is injected (not imported) so the
 * substitution logic stays pure and unit-testable — the caller passes
 * `moment().format` so the output is identical to Templater's own
 * `tp.file.creation_date` rendering (which is `moment(ctime).format(fmt)`).
 */

// Templater's tp.file.creation_date default format when called with no argument.
const CREATION_DATE_DEFAULT_FORMAT = "YYYY-MM-DD HH:mm";

// Matches `<% tp.file.creation_date("fmt") %>` (double/single-quoted or no arg),
// tolerating Templater whitespace-control markers (`<%-`, `_%>`).
const CREATION_DATE_RE =
  /<%[-_]?\s*tp\.file\.creation_date\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)\s*[-_]?%>/g;

// Matches any Templater block still present after substitution.
const TEMPLATER_BLOCK_RE = /<%[\s\S]*?%>/g;

export interface FallbackRenderResult {
  readonly content: string;
  // Templater blocks that this fallback could not resolve (e.g. tokens other
  // than creation_date). Surfaced so the caller can warn instead of silently
  // writing a note that still contains raw `<% %>` markup.
  readonly unresolved: readonly string[];
}

export function renderTemplateFallback(
  raw: string,
  formatDate: (format: string) => string,
): FallbackRenderResult {
  const content = raw.replace(
    CREATION_DATE_RE,
    (_match: string, doubleQuoted?: string, singleQuoted?: string): string => {
      const format = doubleQuoted ?? singleQuoted ?? CREATION_DATE_DEFAULT_FORMAT;
      return formatDate(format);
    },
  );
  const unresolved = content.match(TEMPLATER_BLOCK_RE) ?? [];
  return { content, unresolved: [...unresolved] };
}
