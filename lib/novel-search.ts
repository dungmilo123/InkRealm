/**
 * Pure logic for cross-chapter novel search.
 *
 * Searches across all chapters of a novel and returns matches grouped by chapter
 * with context snippets. No React/Prisma dependencies — fully testable with Node runner.
 *
 * Uses the same case-insensitive matching as lib/chapter-search.ts but operates
 * on the full novel scope rather than a single chapter.
 */

/** A single text match within a chapter */
export type NovelSearchMatch = {
  /** Character offset within the paragraph string */
  startOffset: number;
  /** Length of the matched text */
  length: number;
  /** A context snippet around the match for display in search results */
  snippet: string;
};

/** All matches found in a single chapter */
export type ChapterSearchResult = {
  /** 1-based chapter index */
  chapterIndex: number;
  /** Chapter title */
  chapterTitle: string;
  /** Matches within this chapter (up to maxMatchesPerChapter) */
  matches: NovelSearchMatch[];
  /** Total number of matches in this chapter (may exceed matches.length if capped) */
  totalMatches: number;
};

/** Top-level search result across the entire novel */
export type NovelSearchResult = {
  /** The query that was searched for */
  query: string;
  /** Total number of matches across all chapters */
  totalMatches: number;
  /** Number of chapters that contain at least one match */
  chaptersWithMatches: number;
  /** Per-chapter results, ordered by chapter index */
  chapters: ChapterSearchResult[];
};

/** A chapter's data as input to the search */
export type SearchableChapter = {
  index: number;
  title: string;
  paragraphs: string[];
};

/** Options controlling search behavior */
export type NovelSearchOptions = {
  /** Maximum number of match snippets to return per chapter (default: 3) */
  maxMatchesPerChapter?: number;
  /** Maximum number of characters on each side of a match in a snippet (default: 60) */
  snippetContextChars?: number;
};

const DEFAULT_MAX_MATCHES_PER_CHAPTER = 3;
const DEFAULT_SNIPPET_CONTEXT_CHARS = 60;

/**
 * Extract a context snippet around a match within a paragraph.
 *
 * Returns a substring of `text` centered around the match at `startOffset` with
 * `length` characters, padded by up to `contextChars` on each side. Adds ellipsis
 * when the snippet is truncated at either end.
 */
export function extractSnippet(
  text: string,
  startOffset: number,
  length: number,
  contextChars: number = DEFAULT_SNIPPET_CONTEXT_CHARS
): string {
  // Clamp to word boundaries for cleaner snippets
  let snippetStart = Math.max(0, startOffset - contextChars);
  let snippetEnd = Math.min(text.length, startOffset + length + contextChars);

  // Expand to nearest space boundary (don't cut mid-word)
  if (snippetStart > 0) {
    const spaceIdx = text.indexOf(" ", snippetStart);
    if (spaceIdx !== -1 && spaceIdx < startOffset) {
      snippetStart = spaceIdx + 1;
    }
  }
  if (snippetEnd < text.length) {
    const spaceIdx = text.lastIndexOf(" ", snippetEnd);
    if (spaceIdx > startOffset + length) {
      snippetEnd = spaceIdx;
    }
  }

  let snippet = text.slice(snippetStart, snippetEnd);

  if (snippetStart > 0) snippet = "..." + snippet;
  if (snippetEnd < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Search across all chapters of a novel for a query string.
 *
 * Case-insensitive matching, same algorithm as lib/chapter-search.ts.
 * Returns results grouped by chapter with context snippets.
 *
 * For performance on large novels (100+ chapters, 500K+ words), the search
 * caps snippet collection at `maxMatchesPerChapter` but counts all matches
 * for accurate totals.
 */
export function searchNovel(
  chapters: SearchableChapter[],
  query: string,
  options: NovelSearchOptions = {}
): NovelSearchResult {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return {
      query: trimmed,
      totalMatches: 0,
      chaptersWithMatches: 0,
      chapters: [],
    };
  }

  const maxMatchesPerChapter =
    options.maxMatchesPerChapter ?? DEFAULT_MAX_MATCHES_PER_CHAPTER;
  const snippetContextChars =
    options.snippetContextChars ?? DEFAULT_SNIPPET_CONTEXT_CHARS;

  const lowerQuery = trimmed.toLowerCase();
  const chapterResults: ChapterSearchResult[] = [];
  let totalMatches = 0;

  for (const chapter of chapters) {
    const matches: NovelSearchMatch[] = [];
    let chapterMatchCount = 0;

    for (const paragraph of chapter.paragraphs) {
      const lowerText = paragraph.toLowerCase();
      let searchFrom = 0;

      while (searchFrom <= lowerText.length - lowerQuery.length) {
        const idx = lowerText.indexOf(lowerQuery, searchFrom);
        if (idx === -1) break;

        chapterMatchCount++;

        // Only collect snippet for the first N matches per chapter
        if (matches.length < maxMatchesPerChapter) {
          matches.push({
            startOffset: idx,
            length: trimmed.length,
            snippet: extractSnippet(
              paragraph,
              idx,
              trimmed.length,
              snippetContextChars
            ),
          });
        }

        // Advance past this match (non-overlapping)
        searchFrom = idx + 1;
      }
    }

    if (chapterMatchCount > 0) {
      chapterResults.push({
        chapterIndex: chapter.index,
        chapterTitle: chapter.title,
        matches,
        totalMatches: chapterMatchCount,
      });
      totalMatches += chapterMatchCount;
    }
  }

  return {
    query: trimmed,
    totalMatches,
    chaptersWithMatches: chapterResults.length,
    chapters: chapterResults,
  };
}
