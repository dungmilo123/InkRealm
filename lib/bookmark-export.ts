/**
 * Pure functions for formatting bookmarks as exportable text.
 *
 * Follows the established pure-function pattern (lib/reading-stats.ts,
 * lib/novel-search.ts): no React, no Prisma, no I/O — fully testable
 * with Node's native test runner.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type ExportableBookmark = {
  chapterIndex: number;
  note: string | null;
  createdAt: string; // ISO 8601
};

export type BookmarkExportOptions = {
  novelTitle: string;
  bookmarks: ExportableBookmark[];
  /** Map from chapter index to chapter title */
  chapterTitles: Map<number, string>;
  /** Export format: 'markdown' (default) or 'plain' */
  format?: "markdown" | "plain";
};

// ─── Formatting ─────────────────────────────────────────────────────

/**
 * Format a date string for export display.
 * Returns "Mar 12, 2026" format.
 */
function formatExportDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format bookmarks as a Markdown document.
 *
 * Output format:
 * ```
 * # Bookmarks: Novel Title
 *
 * *3 bookmarks · Exported Apr 3, 2026*
 *
 * ---
 *
 * ## Chapter 5: The Great Discovery
 * *Bookmarked Mar 12, 2026*
 *
 * > This was a really important plot twist
 *
 * ---
 *
 * ## Chapter 12: The Return
 * *Bookmarked Mar 15, 2026*
 * ```
 */
export function formatBookmarksAsMarkdown(
  options: BookmarkExportOptions
): string {
  const { novelTitle, bookmarks, chapterTitles } = options;

  if (bookmarks.length === 0) {
    return `# Bookmarks: ${novelTitle}\n\n*No bookmarks*\n`;
  }

  const exportDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const lines: string[] = [];

  // Header
  lines.push(`# Bookmarks: ${novelTitle}`);
  lines.push("");
  lines.push(
    `*${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"} · Exported ${exportDate}*`
  );
  lines.push("");

  // Each bookmark
  for (const bm of bookmarks) {
    lines.push("---");
    lines.push("");

    const title =
      chapterTitles.get(bm.chapterIndex) ?? `Chapter ${bm.chapterIndex}`;
    lines.push(`## Chapter ${bm.chapterIndex}: ${title}`);
    lines.push(`*Bookmarked ${formatExportDate(bm.createdAt)}*`);

    if (bm.note) {
      lines.push("");
      lines.push(`> ${bm.note.replace(/\n/g, "\n> ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format bookmarks as plain text (simpler, no markdown syntax).
 *
 * Useful for pasting into notes apps or chat.
 */
export function formatBookmarksAsPlainText(
  options: BookmarkExportOptions
): string {
  const { novelTitle, bookmarks, chapterTitles } = options;

  if (bookmarks.length === 0) {
    return `Bookmarks: ${novelTitle}\n\nNo bookmarks\n`;
  }

  const lines: string[] = [];

  lines.push(`Bookmarks: ${novelTitle}`);
  lines.push(
    `${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}`
  );
  lines.push("");

  for (const bm of bookmarks) {
    const title =
      chapterTitles.get(bm.chapterIndex) ?? `Chapter ${bm.chapterIndex}`;
    lines.push(`Ch. ${bm.chapterIndex} - ${title}`);
    lines.push(`  Bookmarked: ${formatExportDate(bm.createdAt)}`);

    if (bm.note) {
      lines.push(`  Note: ${bm.note}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate a safe filename for the bookmark export.
 * Strips non-alphanumeric characters, limits length, adds suffix.
 */
export function generateExportFilename(
  novelTitle: string,
  format: "markdown" | "plain" = "markdown"
): string {
  const safe = novelTitle
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);

  const ext = format === "markdown" ? "md" : "txt";
  return `${safe}-bookmarks.${ext}`;
}
