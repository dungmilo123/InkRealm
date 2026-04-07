/**
 * Unit tests for panel action decision helpers (getTranslatedCount, getTerminalAction).
 *
 * These pure functions were extracted in S02/T01 so the CTA logic
 * can be tested without rendering React components.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  getTranslatedCount,
  getTerminalAction,
  type ChapterStatus,
} from "./panel-actions";

// ── getTranslatedCount ───────────────────────────────────────────────────────

test("getTranslatedCount: empty array → 0", () => {
  assert.equal(getTranslatedCount([]), 0);
});

test("getTranslatedCount: all translated → full count", () => {
  const statuses: ChapterStatus[] = [
    { chapterIndex: 1, status: "translated" },
    { chapterIndex: 2, status: "translated" },
    { chapterIndex: 3, status: "translated" },
  ];
  assert.equal(getTranslatedCount(statuses), 3);
});

test("getTranslatedCount: mix of statuses → only translated counted", () => {
  const statuses: ChapterStatus[] = [
    { chapterIndex: 1, status: "translated" },
    { chapterIndex: 2, status: "translating" },
    { chapterIndex: 3, status: "untranslated" },
    { chapterIndex: 4, status: "translated" },
  ];
  assert.equal(getTranslatedCount(statuses), 2);
});

test("getTranslatedCount: all untranslated → 0", () => {
  const statuses: ChapterStatus[] = [
    { chapterIndex: 1, status: "untranslated" },
    { chapterIndex: 2, status: "untranslated" },
  ];
  assert.equal(getTranslatedCount(statuses), 0);
});

// ── getTerminalAction ────────────────────────────────────────────────────────

test("getTerminalAction: terminal + valid range → 'range-execute'", () => {
  assert.equal(
    getTerminalAction({ isTerminal: true, hasValidRange: true, remaining: 5 }),
    "range-execute"
  );
});

test("getTerminalAction: terminal + no range + remaining > 0 → 'continue'", () => {
  assert.equal(
    getTerminalAction({ isTerminal: true, hasValidRange: false, remaining: 3 }),
    "continue"
  );
});

test("getTerminalAction: terminal + no range + remaining === 0 → 'none'", () => {
  assert.equal(
    getTerminalAction({ isTerminal: true, hasValidRange: false, remaining: 0 }),
    "none"
  );
});

test("getTerminalAction: not terminal → 'start'", () => {
  assert.equal(
    getTerminalAction({ isTerminal: false, hasValidRange: false, remaining: 5 }),
    "start"
  );
});

test("getTerminalAction: terminal + valid range + remaining === 0 → still 'range-execute'", () => {
  // Range overrides even when nothing is remaining
  assert.equal(
    getTerminalAction({ isTerminal: true, hasValidRange: true, remaining: 0 }),
    "range-execute"
  );
});
