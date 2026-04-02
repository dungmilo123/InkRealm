// lib/reading-time.ts
// Client-safe reading time estimation utilities.

/**
 * Average adult reading speed in words per minute.
 * 238 WPM is the commonly cited academic average (Brysbaert, 2019).
 */
const WORDS_PER_MINUTE = 238;

/**
 * Counts words in a single string using whitespace splitting.
 * Handles multiple whitespace, leading/trailing spaces, and empty strings.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Counts total words across an array of paragraphs.
 */
export function countWordsInParagraphs(paragraphs: string[]): number {
  let total = 0;
  for (const p of paragraphs) {
    total += countWords(p);
  }
  return total;
}

/**
 * Estimates reading time in minutes for a given word count.
 * Returns at least 1 minute (rounds up).
 */
export function estimateReadingMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/**
 * Formats a minute count into a human-readable duration string.
 * Examples:
 *   0  → "< 1 min"
 *   1  → "1 min"
 *   45 → "45 min"
 *   60 → "1 hr"
 *   90 → "1 hr 30 min"
 *   150 → "2 hr 30 min"
 */
export function formatReadingTime(minutes: number): string {
  if (minutes <= 0) return "< 1 min";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Formats a word count into a compact human-readable string.
 * Examples: 500 → "500", 1234 → "1.2k", 15678 → "15.7k", 123456 → "123k"
 */
export function formatWordCount(wordCount: number): string {
  if (wordCount < 1000) return `${wordCount}`;
  if (wordCount < 100000) return `${(wordCount / 1000).toFixed(1)}k`;
  return `${Math.round(wordCount / 1000)}k`;
}
