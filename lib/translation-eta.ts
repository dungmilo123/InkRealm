/**
 * Pure ETA calculation for translation jobs.
 * No React dependency — can be tested with Node's native test runner.
 */

export type ChapterTiming = {
  status: "translated" | "translating" | "untranslated";
  completedAt?: string;
};

export type TranslationEta = {
  /** Estimated milliseconds remaining, or null if insufficient data */
  etaMs: number | null;
  /** Human-friendly ETA string (e.g. "~5 min"), or null */
  etaLabel: string | null;
  /** Average ms per chapter (EMA-weighted), or null */
  avgChapterMs: number | null;
};

/**
 * Computes a time-remaining estimate for an in-progress translation job.
 *
 * Algorithm:
 * 1. Collect completedAt timestamps from translated chapters, sorted chronologically
 * 2. Compute consecutive deltas (time between chapter N and chapter N+1 completing)
 *    — the first chapter's duration is measured from jobCreatedAt
 * 3. Use an exponential moving average (EMA, α=0.3) of deltas to weight recent chapters
 *    more heavily (translation speed changes as context/glossary grows)
 * 4. Multiply average-per-chapter by remaining chapter count
 *
 * Returns nulls when there's insufficient data (< 1 completed chapter).
 */
export function calculateTranslationEta(
  chapterStatuses: ChapterTiming[],
  totalChapters: number,
  jobCreatedAt: string | undefined,
): TranslationEta {
  if (!jobCreatedAt || totalChapters === 0) {
    return { etaMs: null, etaLabel: null, avgChapterMs: null };
  }

  // Collect completion timestamps, sorted chronologically
  const completionTimes: number[] = [];
  for (const ch of chapterStatuses) {
    if (ch.status === "translated" && ch.completedAt) {
      completionTimes.push(new Date(ch.completedAt).getTime());
    }
  }

  if (completionTimes.length === 0) {
    return { etaMs: null, etaLabel: null, avgChapterMs: null };
  }

  completionTimes.sort((a, b) => a - b);

  // Build array of durations: time to complete each chapter
  const jobStart = new Date(jobCreatedAt).getTime();
  const durations: number[] = [];
  for (let i = 0; i < completionTimes.length; i++) {
    const prev = i === 0 ? jobStart : completionTimes[i - 1];
    const duration = completionTimes[i] - prev;
    // Skip nonsensical durations (negative or zero — can happen with clock skew or retries)
    if (duration > 0) {
      durations.push(duration);
    }
  }

  if (durations.length === 0) {
    return { etaMs: null, etaLabel: null, avgChapterMs: null };
  }

  // Exponential moving average — alpha = 0.3 gives ~70% weight to recent 3 chapters
  const alpha = 0.3;
  let ema = durations[0];
  for (let i = 1; i < durations.length; i++) {
    ema = alpha * durations[i] + (1 - alpha) * ema;
  }

  const translatedCount = chapterStatuses.filter((ch) => ch.status === "translated").length;
  const remaining = totalChapters - translatedCount;

  if (remaining <= 0) {
    return { etaMs: 0, etaLabel: null, avgChapterMs: Math.round(ema) };
  }

  const etaMs = Math.round(ema * remaining);
  const etaLabel = formatEtaLabel(etaMs);

  return { etaMs, etaLabel, avgChapterMs: Math.round(ema) };
}

/**
 * Formats milliseconds into a human-friendly ETA string.
 * Examples: "~30 sec", "~2 min", "~1 hr 15 min"
 */
export function formatEtaLabel(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);

  if (totalSeconds < 60) {
    return `~${Math.max(totalSeconds, 5)} sec`;
  }

  const totalMinutes = Math.round(ms / 60_000);

  if (totalMinutes < 60) {
    return `~${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (mins === 0) {
    return `~${hours} hr`;
  }

  return `~${hours} hr ${mins} min`;
}
