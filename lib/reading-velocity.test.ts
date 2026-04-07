import {
  getWeekStart,
  computeReadingVelocity,
} from "./reading-velocity";
import type { DailyActivity } from "./reading-stats";

// ─── Helpers ─────────────────────────────────────────────────────────

function day(
  date: string,
  chaptersRead: number,
  estimatedMinutes = chaptersRead * 5
): DailyActivity {
  return { date, chaptersRead, estimatedMinutes };
}

// ─── getWeekStart ───────────────────────────────────────────────────

describe("getWeekStart", () => {
  test("returns Monday for a Monday", () => {
    // 2026-03-30 is a Monday
    expect(getWeekStart("2026-03-30")).toBe("2026-03-30");
  });

  test("returns previous Monday for a Wednesday", () => {
    // 2026-04-01 is a Wednesday
    expect(getWeekStart("2026-04-01")).toBe("2026-03-30");
  });

  test("returns previous Monday for a Sunday", () => {
    // 2026-04-05 is a Sunday
    expect(getWeekStart("2026-04-05")).toBe("2026-03-30");
  });

  test("returns previous Monday for a Saturday", () => {
    // 2026-04-04 is a Saturday
    expect(getWeekStart("2026-04-04")).toBe("2026-03-30");
  });

  test("returns previous Monday for a Friday", () => {
    // 2026-04-03 is a Friday → Monday is 2026-03-30
    expect(getWeekStart("2026-04-03")).toBe("2026-03-30");
  });

  test("handles month boundary correctly", () => {
    // 2026-03-01 is a Sunday → Monday is 2026-02-23
    expect(getWeekStart("2026-03-01")).toBe("2026-02-23");
  });

  test("handles year boundary correctly", () => {
    // 2026-01-01 is a Thursday → Monday is 2025-12-29
    expect(getWeekStart("2026-01-01")).toBe("2025-12-29");
  });
});

// ─── computeReadingVelocity ─────────────────────────────────────────

describe("computeReadingVelocity", () => {
  test("returns empty result for no activity", () => {
    const result = computeReadingVelocity([]);
    expect(result.weeks.length).toBe(0);
    expect(result.maxChapters).toBe(0);
    expect(result.avgChaptersPerWeek).toBe(0);
    expect(result.totalChapters).toBe(0);
    expect(result.trend.direction).toBe("flat");
    expect(result.trend.label).toBe("No data");
  });

  test("returns correct number of weeks", () => {
    const activity = [day("2026-04-01", 3)];
    const result = computeReadingVelocity(activity, 12, "2026-04-03");
    expect(result.weeks.length).toBe(12);
  });

  test("respects weeksToShow parameter", () => {
    const activity = [day("2026-04-01", 3)];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    expect(result.weeks.length).toBe(4);
  });

  test("aggregates daily activity into correct weekly buckets", () => {
    // Week of 2026-03-30 (Mon) to 2026-04-05 (Sun)
    const activity = [
      day("2026-03-30", 2), // Monday
      day("2026-03-31", 3), // Tuesday
      day("2026-04-01", 1), // Wednesday — same week
    ];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");

    // Find the week containing 2026-03-30
    const currentWeek = result.weeks.find((w) => w.weekStart === "2026-03-30");
    expect(currentWeek, "Should find week starting 2026-03-30").toBeTruthy();
    expect(currentWeek.chaptersRead).toBe(6); // 2 + 3 + 1
    expect(currentWeek.isCurrentWeek).toBe(true);
  });

  test("marks current week correctly", () => {
    const activity = [day("2026-04-01", 3)];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");

    const currentWeeks = result.weeks.filter((w) => w.isCurrentWeek);
    expect(currentWeeks.length).toBe(1);
    // 2026-04-03 is Friday, week starts 2026-03-30 (Monday)
    expect(currentWeeks[0].weekStart).toBe("2026-03-30");
  });

  test("computes maxChapters correctly", () => {
    const activity = [
      day("2026-03-16", 5), // week 1: 5
      day("2026-03-23", 10), // week 2: 10
      day("2026-03-30", 3), // week 3: 3
    ];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    expect(result.maxChapters).toBe(10);
  });

  test("computes totalChapters correctly", () => {
    const activity = [
      day("2026-03-16", 5),
      day("2026-03-23", 10),
      day("2026-03-30", 3),
    ];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    expect(result.totalChapters).toBe(18);
  });

  test("avgChaptersPerWeek excludes current partial week", () => {
    // 3 complete weeks + current partial week
    // today is 2026-04-03 (Friday) → current week starts 2026-03-30
    const activity = [
      day("2026-03-09", 4), // week starting 2026-03-09 (complete)
      day("2026-03-16", 6), // week starting 2026-03-16 (complete)
      day("2026-03-23", 8), // week starting 2026-03-23 (complete)
      day("2026-04-01", 2), // current week (partial — excluded from avg)
    ];
    const result = computeReadingVelocity(activity, 5, "2026-04-03");
    // Average of complete weeks: (4 + 6 + 8) / 4 = 4.5
    // (there are 4 complete weeks in a 5-week window when today is Friday)
    // Actually: weeks are Mon 3/2, Mon 3/9, Mon 3/16, Mon 3/23, Mon 3/30(current)
    // Complete weeks with data: 3/9=4, 3/16=6, 3/23=8, others=0
    // 4 completed weeks total (3/2, 3/9, 3/16, 3/23), avg = (0+4+6+8)/4 = 4.5
    expect(result.avgChaptersPerWeek).toBe(4.5);
  });

  test("weeks are ordered chronologically", () => {
    const activity = [day("2026-04-01", 3)];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");

    for (let i = 1; i < result.weeks.length; i++) {
      expect(result.weeks[i].weekStart > result.weeks[i - 1].weekStart).toBeTruthy();
    }
  });

  test("each week has a human-readable label", () => {
    const activity = [day("2026-04-01", 3)];
    const result = computeReadingVelocity(activity, 2, "2026-04-03");

    for (const week of result.weeks) {
      // Label should match "Mon DD" pattern (e.g., "Mar 30")
      expect(/^[A-Z][a-z]{2} \d{1,2}$/.test(week.label)).toBeTruthy();
    }
  });

  test("activity outside the window is ignored", () => {
    const activity = [
      day("2025-01-01", 100), // way outside the 4-week window
      day("2026-04-01", 3),
    ];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    expect(result.totalChapters).toBe(3); // only the recent activity
  });
});

// ─── Trend computation ──────────────────────────────────────────────

describe("computeReadingVelocity trend", () => {
  test("reports 'Not enough data' with fewer than two complete weeks with data", () => {
    // Only 1 complete week has data (3/23), previous complete weeks are all 0
    // → computeTrend sees < 2 complete weeks with non-trivial distinction
    // Actually: with all-zero previous, it returns "up" since recent > 0
    // To get "Not enough data", we need exactly 1 completed week total
    const activity = [day("2026-03-30", 5)]; // current week only
    const result = computeReadingVelocity(activity, 2, "2026-04-03");
    // Only 1 complete week (starts 3/23, which is empty) + current partial week
    // completedWeeks.length === 1 → "Not enough data"
    expect(result.trend.label).toBe("Not enough data");
  });

  test("reports upward trend when most recent week exceeds average", () => {
    // Complete weeks: week of 3/9 = 2ch, week of 3/16 = 3ch, week of 3/23 = 8ch
    // Previous avg: (2+3)/2 = 2.5, recent = 8 → +220%
    const activity = [
      day("2026-03-09", 2),
      day("2026-03-16", 3),
      day("2026-03-23", 8),
    ];
    const result = computeReadingVelocity(activity, 5, "2026-04-03");
    expect(result.trend.direction).toBe("up");
    expect(result.trend.percentChange > 0).toBeTruthy();
  });

  test("reports downward trend when most recent week is below average", () => {
    // Complete weeks: week of 3/9 = 10ch, week of 3/16 = 8ch, week of 3/23 = 2ch
    // Previous avg: (10+8)/2 = 9, recent = 2 → -78%
    const activity = [
      day("2026-03-09", 10),
      day("2026-03-16", 8),
      day("2026-03-23", 2),
    ];
    const result = computeReadingVelocity(activity, 5, "2026-04-03");
    expect(result.trend.direction).toBe("down");
    expect(result.trend.percentChange < 0).toBeTruthy();
  });

  test("reports flat trend when change is within ±10%", () => {
    // Use a tight window so only the data-filled weeks are complete
    // 3 weeks window, today = 2026-04-03 → weeks: 3/16, 3/23, 3/30(current)
    // Complete weeks: 3/16=5, 3/23=5 → recent=5, prevAvg=5 → 0% change
    const activity = [
      day("2026-03-16", 5),
      day("2026-03-23", 5),
    ];
    const result = computeReadingVelocity(activity, 3, "2026-04-03");
    expect(result.trend.direction).toBe("flat");
    expect(Math.abs(result.trend.percentChange) <= 10).toBeTruthy();
  });

  test("handles all-zero previous weeks (no prior activity)", () => {
    // Only the most recent complete week has activity
    const activity = [day("2026-03-23", 5)];
    const result = computeReadingVelocity(activity, 5, "2026-04-03");
    // Previous weeks all 0, recent = 5 → up +100%
    expect(result.trend.direction).toBe("up");
  });

  test("trend label includes sign and percentage", () => {
    const activity = [
      day("2026-03-09", 2),
      day("2026-03-16", 3),
      day("2026-03-23", 8),
    ];
    const result = computeReadingVelocity(activity, 5, "2026-04-03");
    expect(result.trend.label).toContain("%");
    expect(result.trend.label).toContain("vs");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe("computeReadingVelocity edge cases", () => {
  test("returns empty for weeksToShow = 0", () => {
    const activity = [day("2026-04-01", 3)];
    const result = computeReadingVelocity(activity, 0, "2026-04-03");
    expect(result.weeks.length).toBe(0);
  });

  test("handles single day of activity", () => {
    const activity = [day("2026-04-01", 1)];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    expect(result.totalChapters).toBe(1);
    expect(result.maxChapters).toBe(1);
  });

  test("handles multiple days in same week correctly", () => {
    const activity = [
      day("2026-03-23", 1), // Monday
      day("2026-03-24", 2), // Tuesday
      day("2026-03-25", 3), // Wednesday
      day("2026-03-26", 4), // Thursday
      day("2026-03-27", 5), // Friday
    ];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    const week = result.weeks.find((w) => w.weekStart === "2026-03-23");
    expect(week, "Should find week starting 2026-03-23").toBeTruthy();
    expect(week.chaptersRead).toBe(15); // 1+2+3+4+5
  });

  test("accumulates estimated minutes per week", () => {
    const activity = [
      day("2026-03-23", 2, 10),
      day("2026-03-24", 3, 15),
    ];
    const result = computeReadingVelocity(activity, 4, "2026-04-03");
    const week = result.weeks.find((w) => w.weekStart === "2026-03-23");
    expect(week).toBeTruthy();
    expect(week.estimatedMinutes).toBe(25); // 10 + 15
  });
});
