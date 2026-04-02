/**
 * Pure logic for in-reader chapter text search.
 *
 * Operates on an array of paragraph strings (the same shape the reader uses)
 * and returns match locations as { paragraphIndex, startOffset, length } tuples.
 *
 * All search is case-insensitive. No external dependencies.
 */

export type SearchMatch = {
  /** Index into the paragraphs array */
  paragraphIndex: number;
  /** Character offset within the paragraph string */
  startOffset: number;
  /** Length of the matched text */
  length: number;
};

/**
 * Find all occurrences of `query` in `paragraphs` (case-insensitive).
 * Returns an empty array when query is empty or whitespace-only.
 */
export function findMatches(
  paragraphs: string[],
  query: string
): SearchMatch[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const lowerQuery = trimmed.toLowerCase();
  const matches: SearchMatch[] = [];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const lowerText = paragraphs[pi].toLowerCase();
    let searchFrom = 0;

    while (searchFrom <= lowerText.length - lowerQuery.length) {
      const idx = lowerText.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;

      matches.push({
        paragraphIndex: pi,
        startOffset: idx,
        length: trimmed.length,
      });
      // Advance past this match (non-overlapping)
      searchFrom = idx + 1;
    }
  }

  return matches;
}

/**
 * Navigate to the next match index, wrapping around.
 * Returns -1 if there are no matches.
 */
export function nextMatchIndex(
  currentIndex: number,
  totalMatches: number
): number {
  if (totalMatches === 0) return -1;
  return (currentIndex + 1) % totalMatches;
}

/**
 * Navigate to the previous match index, wrapping around.
 * Returns -1 if there are no matches.
 */
export function prevMatchIndex(
  currentIndex: number,
  totalMatches: number
): number {
  if (totalMatches === 0) return -1;
  return (currentIndex - 1 + totalMatches) % totalMatches;
}

/**
 * Format match position for display: "3 of 42"
 * Returns empty string when there are no matches.
 */
export function formatMatchPosition(
  currentIndex: number,
  totalMatches: number
): string {
  if (totalMatches === 0) return "";
  return `${currentIndex + 1} of ${totalMatches}`;
}
