/**
 * Unit tests for panel action decision helpers (getTranslatedCount, getTerminalAction).
 *
 * These pure functions were extracted in S02/T01 so the CTA logic
 * can be tested without rendering React components.
 */

import {
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
