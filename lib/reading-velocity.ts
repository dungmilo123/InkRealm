// lib/reading-velocity.ts
// Pure weekly reading velocity computation — no React or Prisma dependencies.
// Aggregates daily activity into weekly buckets and computes trend direction.

import type { DailyActivity } from "./reading-stats";

// ─── Types ───────────────────────────────────────────────────────────

/** A single week's aggregated reading data. */
export type WeeklyBucket = {
  /** ISO week start date (Monday) in YYYY-MM-DD format. */
  weekStart: string;
  /** Short label for display (e.g., "Mar 10"). */
  label: string;
  /** Total chapters read during this week. */
  chaptersRead: number;
  /** Estimated reading minutes during this week. */
  estimatedMinutes: number;
  /** Whether this is the current (partial) week. */
  isCurrentWeek: boolean;
};

/** Trend direction and magnitude. */
export type VelocityTrend = {
  /** "up" = reading more, "down" = reading less, "flat" = same ±10%. */
  direction: "up" | "down" | "flat";
  /** Percentage change from previous period average (can be negative). */
  percentChange: number;
  /** Human-friendly trend label (e.g., "+25% vs avg"). */
  label: string;
};

/** Full velocity analysis result. */
export type ReadingVelocity = {
  /** Weekly buckets, ordered chronologically. */
  weeks: WeeklyBucket[];
  /** Max chapters in any single week (for scaling bar heights). */
  maxChapters: number;
  /** Average chapters per week (excluding current partial week). */
  avgChaptersPerWeek: number;
  /** Trend comparing the most recent complete week to the average. */
  trend: VelocityTrend;
  /** Total chapters across all weeks. */
  totalChapters: number;
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Returns the Monday of the week containing the given YYYY-MM-DD date.
 * ISO weeks start on Monday (1) and end on Sunday (0→7).
 */
export function getWeekStart(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const mondayOffset = dow === 0 ? 6 : dow - 1; // Sun→6 back, Mon→0, Tue→1, etc.
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date into a short display label (e.g., "Mar 10").
 */
function formatWeekLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00Z");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${month} ${day}`;
}

// ─── Core Computation ───────────────────────────────────────────────

/**
 * Aggregates daily activity into weekly buckets for the last N weeks.
 *
 * @param dailyActivity Daily activity data from computeDailyActivity()
 * @param weeksToShow Number of weeks to include (default: 12)
 * @param today Override "today" for deterministic testing (YYYY-MM-DD)
 */
export function computeReadingVelocity(
  dailyActivity: DailyActivity[],
  weeksToShow: number = 12,
  today?: string
): ReadingVelocity {
  const empty: ReadingVelocity = {
    weeks: [],
    maxChapters: 0,
    avgChaptersPerWeek: 0,
    trend: { direction: "flat", percentChange: 0, label: "No data" },
    totalChapters: 0,
  };

  if (dailyActivity.length === 0 || weeksToShow < 1) return empty;

  const todayKey =
    today ??
    (() => {
      const d = new Date();
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    })();

  // 1. Determine the week boundaries
  const currentWeekStart = getWeekStart(todayKey);

  // Build week start dates going backwards
  const weekStarts: string[] = [];
  {
    const cursor = new Date(currentWeekStart + "T00:00:00Z");
    for (let i = 0; i < weeksToShow; i++) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getUTCDate()).padStart(2, "0");
      weekStarts.unshift(`${y}-${m}-${dd}`);
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    }
  }

  // 2. Index daily activity by week
  const weekMap = new Map<string, { chapters: number; minutes: number }>();
  for (const ws of weekStarts) {
    weekMap.set(ws, { chapters: 0, minutes: 0 });
  }

  for (const day of dailyActivity) {
    const ws = getWeekStart(day.date);
    const bucket = weekMap.get(ws);
    if (bucket) {
      bucket.chapters += day.chaptersRead;
      bucket.minutes += day.estimatedMinutes;
    }
  }

  // 3. Build WeeklyBucket array
  const weeks: WeeklyBucket[] = weekStarts.map((ws) => {
    const data = weekMap.get(ws)!;
    return {
      weekStart: ws,
      label: formatWeekLabel(ws),
      chaptersRead: data.chapters,
      estimatedMinutes: data.minutes,
      isCurrentWeek: ws === currentWeekStart,
    };
  });

  // 4. Compute summary statistics
  const maxChapters = Math.max(...weeks.map((w) => w.chaptersRead), 0);
  const totalChapters = weeks.reduce((sum, w) => sum + w.chaptersRead, 0);

  // Average excludes the current (partial) week for fairness
  const completedWeeks = weeks.filter((w) => !w.isCurrentWeek);
  const avgChaptersPerWeek =
    completedWeeks.length > 0
      ? Math.round(
          (completedWeeks.reduce((sum, w) => sum + w.chaptersRead, 0) /
            completedWeeks.length) *
            10
        ) / 10
      : 0;

  // 5. Compute trend (most recent complete week vs average of all others)
  const trend = computeTrend(completedWeeks);

  return { weeks, maxChapters, avgChaptersPerWeek, trend, totalChapters };
}

/**
 * Computes the trend direction from completed weeks.
 * Compares the most recent complete week to the average of all previous weeks.
 */
function computeTrend(
  completedWeeks: WeeklyBucket[]
): VelocityTrend {
  if (completedWeeks.length < 2) {
    return { direction: "flat", percentChange: 0, label: "Not enough data" };
  }

  // Most recent complete week is the last in the array
  const recentWeek = completedWeeks[completedWeeks.length - 1];
  const recent = recentWeek.chaptersRead;

  // Average of all preceding completed weeks (excluding the most recent)
  const previousWeeks = completedWeeks.slice(0, -1);
  const previousAvg =
    previousWeeks.reduce((sum, w) => sum + w.chaptersRead, 0) /
    previousWeeks.length;

  if (previousAvg === 0) {
    if (recent === 0)
      return { direction: "flat", percentChange: 0, label: "No activity" };
    return { direction: "up", percentChange: 100, label: "+100% vs prior" };
  }

  const percentChange = Math.round(
    ((recent - previousAvg) / previousAvg) * 100
  );

  let direction: "up" | "down" | "flat";
  if (percentChange > 10) direction = "up";
  else if (percentChange < -10) direction = "down";
  else direction = "flat";

  const sign = percentChange > 0 ? "+" : "";
  const label = `${sign}${percentChange}% vs avg`;

  return { direction, percentChange, label };
}
