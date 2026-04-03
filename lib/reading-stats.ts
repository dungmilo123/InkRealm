// lib/reading-stats.ts
// Pure reading statistics utilities — no React or Prisma dependencies.
// Computes analytics from chapter visit timestamps and word counts.

import { estimateReadingMinutes, formatReadingTime } from "./reading-time";

// ─── Types ───────────────────────────────────────────────────────────

/** A single chapter visit with its timestamp and word count. */
export type ChapterVisitData = {
  /** Chapter index (1-based). */
  chapterIndex: number;
  /** ISO timestamp of the visit. */
  visitedAt: string;
  /** Word count of the chapter (0 if unknown). */
  wordCount: number;
};

/** Per-novel reading summary. */
export type NovelReadingStats = {
  /** Number of unique chapters visited. */
  chaptersRead: number;
  /** Total word count across visited chapters. */
  wordsRead: number;
  /** Estimated reading time in minutes (based on 238 WPM). */
  estimatedMinutes: number;
  /** Human-friendly reading time string. */
  estimatedTimeLabel: string;
};

/** User-wide reading streak data. */
export type ReadingStreak = {
  /** Current consecutive days with reading activity (ends today or yesterday). */
  currentStreak: number;
  /** Longest consecutive-day streak ever recorded. */
  longestStreak: number;
  /** Whether today already has reading activity (streak is "alive"). */
  readToday: boolean;
};

/** Daily reading activity bucket. */
export type DailyActivity = {
  /** Date string in YYYY-MM-DD format. */
  date: string;
  /** Number of chapters visited on this day. */
  chaptersRead: number;
  /** Estimated reading minutes on this day. */
  estimatedMinutes: number;
};

/** User-wide reading analytics summary. */
export type ReadingAnalytics = {
  /** Total estimated reading time across all novels, in minutes. */
  totalMinutes: number;
  /** Human-friendly total reading time label. */
  totalTimeLabel: string;
  /** Total words read across all novels. */
  totalWordsRead: number;
  /** Reading streak data. */
  streak: ReadingStreak;
  /** Average chapters per active reading day. */
  avgChaptersPerDay: number;
  /** Number of distinct days with any reading activity. */
  activeDays: number;
};

// ─── Novel-Level Stats ───────────────────────────────────────────────

/**
 * Computes reading stats for a single novel from its chapter visits.
 * Each visit represents a unique chapter read.
 */
export function computeNovelReadingStats(
  visits: ChapterVisitData[]
): NovelReadingStats {
  if (visits.length === 0) {
    return {
      chaptersRead: 0,
      wordsRead: 0,
      estimatedMinutes: 0,
      estimatedTimeLabel: "< 1 min",
    };
  }

  // Deduplicate by chapterIndex (keep first visit per chapter)
  const seen = new Set<number>();
  let wordsRead = 0;
  let chaptersRead = 0;

  for (const visit of visits) {
    if (!seen.has(visit.chapterIndex)) {
      seen.add(visit.chapterIndex);
      chaptersRead++;
      wordsRead += visit.wordCount;
    }
  }

  const estimatedMinutes = estimateReadingMinutes(wordsRead);
  const estimatedTimeLabel = formatReadingTime(estimatedMinutes);

  return { chaptersRead, wordsRead, estimatedMinutes, estimatedTimeLabel };
}

// ─── Streak Calculation ──────────────────────────────────────────────

/**
 * Normalizes a date to YYYY-MM-DD string in the user's local perspective.
 * Uses UTC to avoid timezone edge-case drift in server-side computation.
 */
function toDateKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the difference in calendar days between two YYYY-MM-DD date keys.
 * Returns (b - a) in days.
 */
function dayDifference(a: string, b: string): number {
  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  return Math.round((dateB.getTime() - dateA.getTime()) / 86_400_000);
}

/**
 * Computes the user's reading streak from a flat list of visit timestamps.
 *
 * Algorithm:
 * 1. Extract unique reading days (YYYY-MM-DD) from all visit timestamps
 * 2. Sort chronologically
 * 3. Walk backwards from today to find current streak (consecutive days)
 * 4. Walk forward through all days to find the longest streak ever
 *
 * @param visitTimestamps ISO timestamps of all chapter visits (any order, any novel)
 * @param today Override "today" for deterministic testing (YYYY-MM-DD format)
 */
export function computeReadingStreak(
  visitTimestamps: string[],
  today?: string
): ReadingStreak {
  if (visitTimestamps.length === 0) {
    return { currentStreak: 0, longestStreak: 0, readToday: false };
  }

  // 1. Unique reading days, sorted chronologically
  const daySet = new Set<string>();
  for (const ts of visitTimestamps) {
    daySet.add(toDateKey(ts));
  }
  const days = [...daySet].sort();

  const todayKey = today ?? toDateKey(new Date().toISOString());
  const readToday = daySet.has(todayKey);

  // 2. Find current streak (walk backwards from today/yesterday)
  let currentStreak = 0;
  // Start from today if read today, otherwise from yesterday
  let cursor = readToday
    ? todayKey
    : (() => {
        const d = new Date(todayKey + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        return toDateKey(d.toISOString());
      })();

  // Walk backwards
  while (daySet.has(cursor)) {
    currentStreak++;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = toDateKey(d.toISOString());
  }

  // If we didn't read today and didn't read yesterday, current streak is 0
  if (!readToday && !daySet.has((() => {
    const d = new Date(todayKey + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return toDateKey(d.toISOString());
  })()))  {
    currentStreak = 0;
  }

  // 3. Find longest streak (walk forward through sorted days)
  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < days.length; i++) {
    if (dayDifference(days[i - 1], days[i]) === 1) {
      runLength++;
      longestStreak = Math.max(longestStreak, runLength);
    } else {
      runLength = 1;
    }
  }

  // Ensure longest >= current
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak, readToday };
}

// ─── Daily Activity ──────────────────────────────────────────────────

/**
 * Buckets chapter visits into daily activity summaries.
 * Useful for activity heatmaps or charts.
 *
 * @param visits All chapter visits with timestamps and word counts
 * @returns Array of daily activity buckets, sorted chronologically
 */
export function computeDailyActivity(
  visits: ChapterVisitData[]
): DailyActivity[] {
  if (visits.length === 0) return [];

  // Group by day, deduplicating chapters within each day
  const dayMap = new Map<string, { chapters: Set<number>; totalWords: number }>();

  for (const visit of visits) {
    const key = toDateKey(visit.visitedAt);
    let bucket = dayMap.get(key);
    if (!bucket) {
      bucket = { chapters: new Set(), totalWords: 0 };
      dayMap.set(key, bucket);
    }
    if (!bucket.chapters.has(visit.chapterIndex)) {
      bucket.chapters.add(visit.chapterIndex);
      bucket.totalWords += visit.wordCount;
    }
  }

  // Convert to sorted array
  return [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      chaptersRead: bucket.chapters.size,
      estimatedMinutes: estimateReadingMinutes(bucket.totalWords),
    }));
}

// ─── Aggregate Analytics ─────────────────────────────────────────────

/**
 * Computes user-wide reading analytics from all chapter visits across all novels.
 * This is the top-level function that aggregates everything.
 *
 * @param visits All chapter visits across all novels (with timestamps and word counts)
 * @param today Override for deterministic testing (YYYY-MM-DD)
 */
export function computeReadingAnalytics(
  visits: ChapterVisitData[],
  today?: string
): ReadingAnalytics {
  if (visits.length === 0) {
    return {
      totalMinutes: 0,
      totalTimeLabel: "< 1 min",
      totalWordsRead: 0,
      streak: { currentStreak: 0, longestStreak: 0, readToday: false },
      avgChaptersPerDay: 0,
      activeDays: 0,
    };
  }

  // Deduplicate visits by chapterIndex (globally — a chapter is "read" once)
  // Use novelId-aware dedup: "novelId:chapterIndex" would be ideal but
  // we don't have novelId here. Instead, chapter indices alone are unique
  // within a single computeNovelReadingStats call. For aggregate stats,
  // we count total words from all visits (already deduplicated at the
  // per-novel level by callers).
  const totalWordsRead = visits.reduce((sum, v) => sum + v.wordCount, 0);
  const totalMinutes = estimateReadingMinutes(totalWordsRead);
  const totalTimeLabel = formatReadingTime(totalMinutes);

  const timestamps = visits.map((v) => v.visitedAt);
  const streak = computeReadingStreak(timestamps, today);

  const dailyActivity = computeDailyActivity(visits);
  const activeDays = dailyActivity.length;
  const totalChaptersRead = dailyActivity.reduce(
    (sum, d) => sum + d.chaptersRead,
    0
  );
  const avgChaptersPerDay =
    activeDays > 0 ? Math.round((totalChaptersRead / activeDays) * 10) / 10 : 0;

  return {
    totalMinutes,
    totalTimeLabel,
    totalWordsRead,
    streak,
    avgChaptersPerDay,
    activeDays,
  };
}
