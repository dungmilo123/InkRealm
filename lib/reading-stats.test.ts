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
    expect(result.chaptersRead).toBe(0);
    expect(result.wordsRead).toBe(0);
    expect(result.estimatedMinutes).toBe(0);
    expect(result.estimatedTimeLabel).toBe("< 1 min");
  });

  test("counts chapters and words from visits", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(2, "2026-04-01T11:00:00Z", 2000),
      visit(3, "2026-04-02T10:00:00Z", 500),
    ];
    const result = computeNovelReadingStats(visits);
    expect(result.chaptersRead).toBe(3);
    expect(result.wordsRead).toBe(3500);
    // 3500 / 238 = 14.7 → ceil = 15
    expect(result.estimatedMinutes).toBe(15);
    expect(result.estimatedTimeLabel).toBe("15 min");
  });

  test("deduplicates visits by chapter index", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(1, "2026-04-01T15:00:00Z", 1000), // re-visit of ch 1
      visit(2, "2026-04-02T10:00:00Z", 500),
    ];
    const result = computeNovelReadingStats(visits);
    expect(result.chaptersRead).toBe(2);
    expect(result.wordsRead).toBe(1500); // 1000 + 500, not 2500
  });

  test("handles zero word counts gracefully", () => {
    const visits = [visit(1, "2026-04-01T10:00:00Z", 0)];
    const result = computeNovelReadingStats(visits);
    expect(result.chaptersRead).toBe(1);
    expect(result.wordsRead).toBe(0);
    expect(result.estimatedMinutes).toBe(0);
  });

  test("formats multi-hour reading times", () => {
    // 238 * 90 = 21420 words → 90 minutes → "1 hr 30 min"
    const visits = [visit(1, "2026-04-01T10:00:00Z", 21420)];
    const result = computeNovelReadingStats(visits);
    expect(result.estimatedMinutes).toBe(90);
    expect(result.estimatedTimeLabel).toBe("1 hr 30 min");
  });
});

// ─── computeReadingStreak ────────────────────────────────────────────

describe("computeReadingStreak", () => {
  test("returns zeros for no timestamps", () => {
    const result = computeReadingStreak([]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.readToday).toBe(false);
  });

  test("detects read today", () => {
    const result = computeReadingStreak(
      ["2026-04-03T14:30:00Z"],
      "2026-04-03"
    );
    expect(result.readToday).toBe(true);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  test("counts 3-day streak ending today", () => {
    const timestamps = [
      "2026-04-01T10:00:00Z",
      "2026-04-02T11:00:00Z",
      "2026-04-03T09:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.readToday).toBe(true);
  });

  test("counts streak ending yesterday (still active)", () => {
    const timestamps = [
      "2026-04-01T10:00:00Z",
      "2026-04-02T11:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    expect(result.currentStreak).toBe(2);
    expect(result.readToday).toBe(false);
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
    expect(result.currentStreak).toBe(2); // Apr 2 + Apr 3
    expect(result.longestStreak).toBe(2); // Mar 30-31 tie with Apr 2-3
  });

  test("current streak 0 when last read was 2+ days ago", () => {
    const timestamps = ["2026-03-30T10:00:00Z"];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
    expect(result.readToday).toBe(false);
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
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  test("handles multiple visits on the same day", () => {
    const timestamps = [
      "2026-04-03T08:00:00Z",
      "2026-04-03T12:00:00Z",
      "2026-04-03T20:00:00Z",
    ];
    const result = computeReadingStreak(timestamps, "2026-04-03");
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  test("handles single day reading", () => {
    const result = computeReadingStreak(
      ["2026-04-03T10:00:00Z"],
      "2026-04-03"
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.readToday).toBe(true);
  });
});

// ─── computeDailyActivity ────────────────────────────────────────────

describe("computeDailyActivity", () => {
  test("returns empty array for no visits", () => {
    expect(computeDailyActivity([])).toEqual([]);
  });

  test("buckets visits by date", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(2, "2026-04-01T14:00:00Z", 500),
      visit(3, "2026-04-02T10:00:00Z", 2000),
    ];
    const result = computeDailyActivity(visits);
    expect(result.length).toBe(2);
    expect(result[0].date).toBe("2026-04-01");
    expect(result[0].chaptersRead).toBe(2);
    expect(result[1].date).toBe("2026-04-02");
    expect(result[1].chaptersRead).toBe(1);
  });

  test("deduplicates same chapter within same day", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 500),
      visit(1, "2026-04-01T15:00:00Z", 500), // same chapter revisit
    ];
    const result = computeDailyActivity(visits);
    expect(result.length).toBe(1);
    expect(result[0].chaptersRead).toBe(1);
    // Words only counted once: 500 / 238 = 2.1 → ceil = 3
    expect(result[0].estimatedMinutes).toBe(3);
  });

  test("returns sorted results", () => {
    const visits = [
      visit(1, "2026-04-03T10:00:00Z", 238),
      visit(2, "2026-04-01T10:00:00Z", 238),
    ];
    const result = computeDailyActivity(visits);
    expect(result[0].date).toBe("2026-04-01");
    expect(result[1].date).toBe("2026-04-03");
  });

  test("calculates estimated reading minutes per day", () => {
    // 2380 words = 10 min exactly
    const visits = [visit(1, "2026-04-01T10:00:00Z", 2380)];
    const result = computeDailyActivity(visits);
    expect(result[0].estimatedMinutes).toBe(10);
  });
});

// ─── computeReadingAnalytics ─────────────────────────────────────────

describe("computeReadingAnalytics", () => {
  test("returns defaults for no visits", () => {
    const result = computeReadingAnalytics([]);
    expect(result.totalMinutes).toBe(0);
    expect(result.totalTimeLabel).toBe("< 1 min");
    expect(result.totalWordsRead).toBe(0);
    expect(result.streak.currentStreak).toBe(0);
    expect(result.avgChaptersPerDay).toBe(0);
    expect(result.activeDays).toBe(0);
  });

  test("aggregates stats across visits", () => {
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 1000),
      visit(2, "2026-04-01T14:00:00Z", 500),
      visit(3, "2026-04-02T10:00:00Z", 2000),
      visit(4, "2026-04-03T10:00:00Z", 1500),
    ];
    const result = computeReadingAnalytics(visits, "2026-04-03");

    expect(result.totalWordsRead).toBe(5000);
    // 5000 / 238 = 21.008… → ceil = 22
    expect(result.totalMinutes).toBe(22);
    expect(result.streak.currentStreak).toBe(3);
    expect(result.activeDays).toBe(3);
    // 4 chapters / 3 days = 1.333... → rounded to 1.3
    expect(result.avgChaptersPerDay).toBe(1.3);
  });

  test("streak calculation integrates correctly", () => {
    const visits = [
      visit(1, "2026-04-02T10:00:00Z", 238),
      visit(2, "2026-04-03T10:00:00Z", 238),
    ];
    const result = computeReadingAnalytics(visits, "2026-04-03");
    expect(result.streak.currentStreak).toBe(2);
    expect(result.streak.readToday).toBe(true);
  });

  test("formats total reading time label", () => {
    // 238 * 120 = 28560 words → 120 min → "2 hr"
    const visits = [visit(1, "2026-04-01T10:00:00Z", 28560)];
    const result = computeReadingAnalytics(visits, "2026-04-01");
    expect(result.totalMinutes).toBe(120);
    expect(result.totalTimeLabel).toBe("2 hr");
  });

  test("avgChaptersPerDay rounds to 1 decimal", () => {
    // 3 chapters across 2 days = 1.5
    const visits = [
      visit(1, "2026-04-01T10:00:00Z", 100),
      visit(2, "2026-04-01T14:00:00Z", 100),
      visit(3, "2026-04-02T10:00:00Z", 100),
    ];
    const result = computeReadingAnalytics(visits, "2026-04-02");
    expect(result.avgChaptersPerDay).toBe(1.5);
  });
});
