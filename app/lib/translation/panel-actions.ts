/**
 * Pure helpers for translation panel CTA decision logic.
 *
 * These are extracted so they can be unit-tested without rendering React components.
 */

export type ChapterStatus = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
  completedAt?: string;
};

/**
 * Count chapters with status === 'translated' from the cross-job merged
 * chapterStatuses array (computed in S01).
 */
export function getTranslatedCount(chapterStatuses: ChapterStatus[]): number {
  return chapterStatuses.filter((s) => s.status === "translated").length;
}

export type JobScopedProgressInput = {
  /** Current job counters (range/job scoped). */
  jobCompletedChapters?: number | null;
  jobTotalChapters?: number | null;
  /** Fallback counters (cross-job/global). */
  fallbackCompletedChapters: number;
  fallbackTotalChapters: number;
};

export type JobScopedProgress = {
  completedChapters: number;
  totalChapters: number;
  progressPercent: number;
};

/**
 * Derive safe, job-scoped progress values for UI display.
 *
 * If a job exists, prefer its `completedChapters/totalChapters` counters so
 * range jobs don't mix with cross-job translated counts (e.g. "15 of 4").
 * Falls back to cross-job counters only when job counters are unavailable.
 */
export function getJobScopedProgress(input: JobScopedProgressInput): JobScopedProgress {
  const total = typeof input.jobTotalChapters === "number"
    ? input.jobTotalChapters
    : input.fallbackTotalChapters;

  const completed = typeof input.jobCompletedChapters === "number"
    ? input.jobCompletedChapters
    : input.fallbackCompletedChapters;

  const totalChapters = Math.max(0, total);
  if (totalChapters === 0) {
    return { completedChapters: 0, totalChapters: 0, progressPercent: 0 };
  }

  const completedChapters = Math.max(0, Math.min(completed, totalChapters));
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((completedChapters / totalChapters) * 100))
  );

  return { completedChapters, totalChapters, progressPercent };
}

export type TerminalAction = "range-execute" | "continue" | "start" | "none";

/**
 * Decide which CTA action to show when the panel is in a terminal or idle state.
 *
 * - Terminal + valid range → 'range-execute' (POST /jobs with range)
 * - Terminal + no range + remaining > 0 → 'continue' (POST /continue)
 * - Not terminal → 'start'
 * - Otherwise → 'none'
 */
export function getTerminalAction(opts: {
  isTerminal: boolean;
  hasValidRange: boolean;
  remaining: number;
}): TerminalAction {
  const { isTerminal, hasValidRange, remaining } = opts;

  if (isTerminal && hasValidRange) return "range-execute";
  if (isTerminal && !hasValidRange && remaining > 0) return "continue";
  if (!isTerminal) return "start";
  return "none";
}
