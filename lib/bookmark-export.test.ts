import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBookmarksAsMarkdown,
  formatBookmarksAsPlainText,
  generateExportFilename,
  type ExportableBookmark,
  type BookmarkExportOptions,
} from "./bookmark-export";

// ─── Helpers ────────────────────────────────────────────────────────

function makeBookmark(
  overrides: Partial<ExportableBookmark> = {}
): ExportableBookmark {
  return {
    chapterIndex: 1,
    note: null,
    createdAt: "2026-03-12T10:00:00.000Z",
    ...overrides,
  };
}

function makeOptions(
  overrides: Partial<BookmarkExportOptions> = {}
): BookmarkExportOptions {
  return {
    novelTitle: "The Great Novel",
    bookmarks: [makeBookmark()],
    chapterTitles: new Map([[1, "The Beginning"]]),
    ...overrides,
  };
}

// ─── formatBookmarksAsMarkdown ──────────────────────────────────────

describe("formatBookmarksAsMarkdown", () => {
  it("returns a minimal message for empty bookmarks", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({ bookmarks: [] })
    );
    assert.ok(result.includes("# Bookmarks: The Great Novel"));
    assert.ok(result.includes("*No bookmarks*"));
  });

  it("includes header with novel title and bookmark count", () => {
    const result = formatBookmarksAsMarkdown(makeOptions());
    assert.ok(result.includes("# Bookmarks: The Great Novel"));
    assert.ok(result.includes("1 bookmark ·"));
    // No plural "s" for 1 bookmark
    assert.ok(!result.includes("1 bookmarks"));
  });

  it("pluralizes bookmark count correctly", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({
        bookmarks: [
          makeBookmark({ chapterIndex: 1 }),
          makeBookmark({ chapterIndex: 5 }),
        ],
        chapterTitles: new Map([
          [1, "Chapter One"],
          [5, "Chapter Five"],
        ]),
      })
    );
    assert.ok(result.includes("2 bookmarks ·"));
  });

  it("formats each bookmark with chapter heading and date", () => {
    const result = formatBookmarksAsMarkdown(makeOptions());
    assert.ok(result.includes("## Chapter 1: The Beginning"));
    assert.ok(result.includes("*Bookmarked Mar 12, 2026*"));
  });

  it("includes note as blockquote when present", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({
        bookmarks: [
          makeBookmark({ note: "Important plot twist here" }),
        ],
      })
    );
    assert.ok(result.includes("> Important plot twist here"));
  });

  it("omits note section when note is null", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({
        bookmarks: [makeBookmark({ note: null })],
      })
    );
    assert.ok(!result.includes(">"));
  });

  it("falls back to 'Chapter N' when title is not in map", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({
        bookmarks: [makeBookmark({ chapterIndex: 99 })],
        chapterTitles: new Map(), // no titles
      })
    );
    assert.ok(result.includes("## Chapter 99: Chapter 99"));
  });

  it("separates bookmarks with horizontal rules", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({
        bookmarks: [
          makeBookmark({ chapterIndex: 1 }),
          makeBookmark({ chapterIndex: 2 }),
        ],
        chapterTitles: new Map([
          [1, "First"],
          [2, "Second"],
        ]),
      })
    );
    const ruleCount = (result.match(/^---$/gm) || []).length;
    assert.equal(ruleCount, 2); // one separator per bookmark
  });

  it("handles multi-line notes with blockquote continuation", () => {
    const result = formatBookmarksAsMarkdown(
      makeOptions({
        bookmarks: [
          makeBookmark({ note: "Line one\nLine two\nLine three" }),
        ],
      })
    );
    assert.ok(result.includes("> Line one\n> Line two\n> Line three"));
  });
});

// ─── formatBookmarksAsPlainText ─────────────────────────────────────

describe("formatBookmarksAsPlainText", () => {
  it("returns a minimal message for empty bookmarks", () => {
    const result = formatBookmarksAsPlainText(
      makeOptions({ bookmarks: [] })
    );
    assert.ok(result.includes("Bookmarks: The Great Novel"));
    assert.ok(result.includes("No bookmarks"));
  });

  it("formats each bookmark with chapter and date", () => {
    const result = formatBookmarksAsPlainText(makeOptions());
    assert.ok(result.includes("Ch. 1 - The Beginning"));
    assert.ok(result.includes("Bookmarked: Mar 12, 2026"));
  });

  it("includes note prefixed with 'Note:'", () => {
    const result = formatBookmarksAsPlainText(
      makeOptions({
        bookmarks: [makeBookmark({ note: "My annotation" })],
      })
    );
    assert.ok(result.includes("Note: My annotation"));
  });

  it("omits note line when note is null", () => {
    const result = formatBookmarksAsPlainText(
      makeOptions({
        bookmarks: [makeBookmark({ note: null })],
      })
    );
    assert.ok(!result.includes("Note:"));
  });
});

// ─── generateExportFilename ─────────────────────────────────────────

describe("generateExportFilename", () => {
  it("generates .md filename from novel title", () => {
    const filename = generateExportFilename("The Great Novel");
    assert.equal(filename, "the-great-novel-bookmarks.md");
  });

  it("generates .txt filename for plain format", () => {
    const filename = generateExportFilename("The Great Novel", "plain");
    assert.equal(filename, "the-great-novel-bookmarks.txt");
  });

  it("strips special characters from title", () => {
    const filename = generateExportFilename("Héllo! (World) #1");
    assert.equal(filename, "hllo-world-1-bookmarks.md");
  });

  it("collapses multiple spaces into single dash", () => {
    const filename = generateExportFilename("The   Great   Novel");
    assert.equal(filename, "the-great-novel-bookmarks.md");
  });

  it("truncates long titles to 50 characters", () => {
    const longTitle = "A".repeat(100);
    const filename = generateExportFilename(longTitle);
    // 50 chars of title + "-bookmarks.md" = 63 total
    assert.ok(filename.length <= 64);
    assert.ok(filename.endsWith("-bookmarks.md"));
  });
});
