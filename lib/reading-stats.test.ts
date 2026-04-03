import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  computeNovelReadingStats,
  computeReadingStreak,
  computeDailyActivity,
  computeReadingAnalytics,
  type ChapterVisitData,
} from "./reading-stats";

// ─── Helpers ─────────────────────────────────────────────────────────

function visit(
  chapterIndex: number,
  visitedAt: string,
  wordCount = 238
): ChapterVisitData {
  return { chapterIndex, visitedAt, wordCount };
}

// ─── computeNovelReadingStats ────────────────────────────────────────

describe("computeNovelReadingStats", () => {
  test("returns zeros for empty visits", () => {
    const result = computeNovelReadingStats([]);
    assert.equal(result.chaptersRead, 0);
    assert.equal(result.wordsRead, 0);
    assert.equal(result.estimatedMinutes, 0);
    assert.equal(result.estimatedTimeLabel, "< 1 min");
  });

  test("counts chapters and words from visits", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(2, "2026-04-01T11:00:00Z", 2000),
      visit(3, "2026-04-02T10:00:00Z", 500),
    ];
    const result = computeNovelReadingStats(visits);
    assert.equal(result.chaptersRead, 3);
    assert.equal(result.wordsRead, 3500);
    // 3500 / 238 = 14.7 → ceil = 15
    assert.equal(result.estimatedMinutes, 15);
    assert.equal(result.estimatedTimeLabel, "15 min");
  });

  test("deduplicates visits by chapter index", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(1, "2026-04-01T15:00:00Z", 1000), // re-visit of ch 1
      visit(2, "2026-04-02T10:00:00Z", 500),
    ];
    const result = computeNovelReadingStats(visits);
    assert.equal(result.chaptersRead, 2);
    assert.equal(result.wordsRead, 1500); // 1000 + 500, not 2500
  });

  test("handles zero word counts gracefully", () => {
    const visits = [visit(1, "2026-04-01T10:00:00Z", 0)];
    const result = computeNovelReadingStats(visits);
    assert.equal(result.chaptersRead, 1);
    assert.equal(result.wordsRead, 0);
    assert.equal(result.estimatedMinutes, 0);
  });

  test("formats multi-hour reading times", () => {
    // 238 * 90 = 21420 words → 90 minutes → "1 hr 30 min"
    const visits = [visit(1, "2026-04-01T10:00:00Z", 21420)];
    const result = computeNovelReadingStats(visits);
    assert.equal(result.estimatedMinutes, 90);
    assert.equal(result.estimatedTimeLabel, "1 hr 30 min");
  });
});

// ─── computeReadingStreak ────────────────────────────────────────────

describe("computeReadingStreak", () => {
  test("returns zeros for no timestamps", () => {
    const result = computeReadingStreak([]);
    assert.equal(result.currentStreak, 0);
    assert.equal(result.longestStreak, 0);
    assert.equal(result.readToday, false);
  });

  test("detects read today", () => {
    const result = computeReadingStreak(
      ["2026-04-03T14:30:00Z"],
      "2026-04-03"
    );
    assert.equal(result.readToday, true);
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 1);
  });

  test("counts 3-day streak ending today", () => {
    const timestamps = [
      "2026-04-01T10:00:00Z",
      "2026-04-02T11:00:00Z",
      "2026-04-03T09:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    assert.equal(result.currentStreak, 3);
    assert.equal(result.longestStreak, 3);
    assert.equal(result.readToday, true);
  });

  test("counts streak ending yesterday (still active)", () => {
    const timestamps = [
      "2026-04-01T10:00:00Z",
      "2026-04-02T11:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    assert.equal(result.currentStreak, 2);
    assert.equal(result.readToday, false);
  });

  test("streak broken if gap > 1 day", () => {
    const timestamps = [
      "2026-03-30T10:00:00Z",
      "2026-03-31T10:00:00Z",
      // gap: April 1st missing
      "2026-04-02T10:00:00Z",
      "2026-04-03T10:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    assert.equal(result.currentStreak, 2); // Apr 2 + Apr 3
    assert.equal(result.longestStreak, 2); // Mar 30-31 tie with Apr 2-3
  });

  test("current streak 0 when last read was 2+ days ago", () => {
    const timestamps = ["2026-03-30T10:00:00Z"];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    assert.equal(result.currentStreak, 0);
    assert.equal(result.longestStreak, 1);
    assert.equal(result.readToday, false);
  });

  test("longest streak can be historical (not current)", () => {
    const timestamps = [
      // 5-day streak in March
      "2026-03-10T10:00:00Z",
      "2026-03-11T10:00:00Z",
      "2026-03-12T10:00:00Z",
      "2026-03-13T10:00:00Z",
      "2026-03-14T10:00:00Z",
      // gap
      // 2-day current streak
      "2026-04-02T10:00:00Z",
      "2026-04-03T10:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    assert.equal(result.currentStreak, 2);
    assert.equal(result.longestStreak, 5);
  });

  test("handles multiple visits on the same day", () => {
    const timestamps = [
      "2026-04-03T08:00:00Z",
      "2026-04-03T12:00:00Z",
      "2026-04-03T20:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 1);
  });

  test("handles single day reading", () => {
    const result = computeReadingStreak(
      ["2026-04-03T10:00:00Z"],
      "2026-04-03"
    );
    assert.equal(result.currentStreak, 1);
    assert.equal(result.longestStreak, 1);
    assert.equal(result.readToday, true);
  });
});

// ─── computeDailyActivity ────────────────────────────────────────────

describe("computeDailyActivity", () => {
  test("returns empty array for no visits", () => {
    assert.deepEqual(computeDailyActivity([]), []);
  });

  test("buckets visits by date", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(2, "2026-04-01T14:00:00Z", 500),
      visit(3, "2026-04-02T10:00:00Z", 2000),
    ];
    const result = computeDailyActivity(visits);
    assert.equal(result.length, 2);
    assert.equal(result[0].date, "2026-04-01");
    assert.equal(result[0].chaptersRead, 2);
    assert.equal(result[1].date, "2026-04-02");
    assert.equal(result[1].chaptersRead, 1);
  });

  test("deduplicates same chapter within same day", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 500),
      visit(1, "2026-04-01T15:00:00Z", 500), // same chapter revisit
    ];
    const result = computeDailyActivity(visits);
    assert.equal(result.length, 1);
    assert.equal(result[0].chaptersRead, 1);
    // Words only counted once: 500 / 238 = 2.1 → ceil = 3
    assert.equal(result[0].estimatedMinutes, 3);
  });

  test("returns sorted results", () => {
    const visits = [
      visit(1, "2026-04-03T10:00:00Z", 238),
      visit(2, "2026-04-01T10:00:00Z", 238),
    ];
    const result = computeDailyActivity(visits);
    assert.equal(result[0].date, "2026-04-01");
    assert.equal(result[1].date, "2026-04-03");
  });

  test("calculates estimated reading minutes per day", () => {
    // 2380 words = 10 min exactly
    const visits = [visit(1, "2026-04-01T10:00:00Z", 2380)];
    const result = computeDailyActivity(visits);
    assert.equal(result[0].estimatedMinutes, 10);
  });
});

// ─── computeReadingAnalytics ─────────────────────────────────────────

describe("computeReadingAnalytics", () => {
  test("returns defaults for no visits", () => {
    const result = computeReadingAnalytics([]);
    assert.equal(result.totalMinutes, 0);
    assert.equal(result.totalTimeLabel, "< 1 min");
    assert.equal(result.totalWordsRead, 0);
    assert.equal(result.streak.currentStreak, 0);
    assert.equal(result.avgChaptersPerDay, 0);
    assert.equal(result.activeDays, 0);
  });

  test("aggregates stats across visits", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(2, "2026-04-01T14:00:00Z", 500),
      visit(3, "2026-04-02T10:00:00Z", 2000),
      visit(4, "2026-04-03T10:00:00Z", 1500),
    ];
    const result = computeReadingAnalytics(visits, "2026-04-03");

    assert.equal(result.totalWordsRead, 5000);
    // 5000 / 238 = 21.008… → ceil = 22
    assert.equal(result.totalMinutes, 22);
    assert.equal(result.streak.currentStreak, 3);
    assert.equal(result.activeDays, 3);
    // 4 chapters / 3 days = 1.333... → rounded to 1.3
    assert.equal(result.avgChaptersPerDay, 1.3);
  });

  test("streak calculation integrates correctly", () => {
    const visits = [
      visit(1, "2026-04-02T10:00:00Z", 238),
      visit(2, "2026-04-03T10:00:00Z", 238),
    ];
    const result = computeReadingAnalytics(visits, "2026-04-03");
    assert.equal(result.streak.currentStreak, 2);
    assert.equal(result.streak.readToday, true);
  });

  test("formats total reading time label", () => {
    // 238 * 120 = 28560 words → 120 min → "2 hr"
    const visits = [visit(1, "2026-04-01T10:00:00Z", 28560)];
    const result = computeReadingAnalytics(visits, "2026-04-01");
    assert.equal(result.totalMinutes, 120);
    assert.equal(result.totalTimeLabel, "2 hr");
  });

  test("avgChaptersPerDay rounds to 1 decimal", () => {
    // 3 chapters across 2 days = 1.5
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 100),
      visit(2, "2026-04-01T14:00:00Z", 100),
      visit(3, "2026-04-02T10:00:00Z", 100),
    ];
    const result = computeReadingAnalytics(visits, "2026-04-02");
    assert.equal(result.avgChaptersPerDay, 1.5);
  });
});
