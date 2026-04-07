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
