/**
 * Unit tests for panel decision helpers
 * (getTranslatedCount, getJobScopedProgress, getTerminalAction).
 *
 * These pure functions are tested without rendering React components.
 */

import {
  getJobScopedProgress,
  getTranslatedCount,
  getTerminalAction,
  type ChapterStatus,
} from "./panel-actions";

// ── getTranslatedCount ───────────────────────────────────────────────────────

test("getTranslatedCount: empty array → 0", () => {
  expect(getTranslatedCount([])).toBe(0);
});

test("getTranslatedCount: all translated → full count", () => {
  const statuses: ChapterStatus[] = [
    { chapterIndex: 1, status: "translated" },
    { chapterIndex: 2, status: "translated" },
    { chapterIndex: 3, status: "translated" },
  ];
  expect(getTranslatedCount(statuses)).toBe(3);
});

test("getTranslatedCount: mix of statuses → only translated counted", () => {
  const statuses: ChapterStatus[] = [
    { chapterIndex: 1, status: "translated" },
    { chapterIndex: 2, status: "translating" },
    { chapterIndex: 3, status: "untranslated" },
    { chapterIndex: 4, status: "translated" },
  ];
  expect(getTranslatedCount(statuses)).toBe(2);
});

test("getTranslatedCount: all untranslated → 0", () => {
  const statuses: ChapterStatus[] = [
    { chapterIndex: 1, status: "untranslated" },
    { chapterIndex: 2, status: "untranslated" },
  ];
  expect(getTranslatedCount(statuses)).toBe(0);
});

// ── getJobScopedProgress ────────────────────────────────────────────────────

test("getJobScopedProgress: uses job-scoped counters when available", () => {
  const result = getJobScopedProgress({
    jobCompletedChapters: 2,
    jobTotalChapters: 4,
    fallbackCompletedChapters: 15,
    fallbackTotalChapters: 15,
  });

  expect(result).toEqual({
    completedChapters: 2,
    totalChapters: 4,
    progressPercent: 50,
  });
});

test("getJobScopedProgress: clamps impossible completed values", () => {
  const result = getJobScopedProgress({
    jobCompletedChapters: 15,
    jobTotalChapters: 4,
    fallbackCompletedChapters: 15,
    fallbackTotalChapters: 15,
  });

  expect(result).toEqual({
    completedChapters: 4,
    totalChapters: 4,
    progressPercent: 100,
  });
});

test("getJobScopedProgress: falls back to cross-job counters when job counters are missing", () => {
  const result = getJobScopedProgress({
    fallbackCompletedChapters: 3,
    fallbackTotalChapters: 10,
  });

  expect(result).toEqual({
    completedChapters: 3,
    totalChapters: 10,
    progressPercent: 30,
  });
});

test("getJobScopedProgress: zero/negative total returns zeroed progress", () => {
  const result = getJobScopedProgress({
    jobCompletedChapters: 5,
    jobTotalChapters: 0,
    fallbackCompletedChapters: 5,
    fallbackTotalChapters: 0,
  });

  expect(result).toEqual({
    completedChapters: 0,
    totalChapters: 0,
    progressPercent: 0,
  });
});

// ── getTerminalAction ────────────────────────────────────────────────────────

test("getTerminalAction: terminal + valid range → 'range-execute'", () => {
  expect(getTerminalAction({ isTerminal: true, hasValidRange: true, remaining: 5 })).toBe("range-execute");
});

test("getTerminalAction: terminal + no range + remaining > 0 → 'continue'", () => {
  expect(getTerminalAction({ isTerminal: true, hasValidRange: false, remaining: 3 })).toBe("continue");
});

test("getTerminalAction: terminal + no range + remaining === 0 → 'none'", () => {
  expect(getTerminalAction({ isTerminal: true, hasValidRange: false, remaining: 0 })).toBe("none");
});

test("getTerminalAction: not terminal → 'start'", () => {
  expect(getTerminalAction({ isTerminal: false, hasValidRange: false, remaining: 5 })).toBe("start");
});

test("getTerminalAction: terminal + valid range + remaining === 0 → still 'range-execute'", () => {
  // Range overrides even when nothing is remaining
  expect(getTerminalAction({ isTerminal: true, hasValidRange: true, remaining: 0 })).toBe("range-execute");
});
