// app/lib/dashboard-cache.ts
// Cached dashboard data fetching to reduce database round-trips.
// Uses Next.js unstable_cache for request deduplication and time-based revalidation.

import { unstable_cache } from "next/cache";
import { listNovels } from "./novels";
import { getReadingProgressBatch, getRecentlyReadNovels } from "./reading-progress";
import { getBookmarkCountsBatch } from "./bookmarks";
import { getChapterVisitsForAnalytics } from "./reading-stats-data";
import {
  computeReadingAnalytics,
  computeDailyActivity,
  type ReadingAnalytics,
  type DailyActivity,
} from "@/lib/reading-stats";
import { computeReadingVelocity, type ReadingVelocity } from "@/lib/reading-velocity";
import type { Novel } from "@/app/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardData = {
  novels: Novel[];
  progressMap: Map<string, { lastChapterIndex: number; totalVisited: number; updatedAt: Date }>;
  bookmarkCountMap: Map<string, number>;
  analytics: ReadingAnalytics | null;
  dailyActivity: DailyActivity[];
  velocity: ReadingVelocity | null;
  recentlyRead: Array<{
    novel: { id: string; title: string; fileType: string; chapterCount: number | null };
    lastChapterIndex: number;
    totalVisited: number;
    lastReadAt: Date;
  }>;
};

// ─── Cached Fetchers ────────────────────────────────────────────────────────

/**
 * Fetches novels list with 60-second cache.
 * Novel list changes infrequently (only on upload/delete).
 */
const getCachedNovels = unstable_cache(
  async (userId: string) => listNovels(userId),
  ["dashboard-novels"],
  { revalidate: 60, tags: ["novels"] }
);

/**
 * Fetches reading analytics with 5-minute cache.
 * Analytics are computed from historical data that doesn't change rapidly.
 * The cache key includes userId to ensure user isolation.
 */
const getCachedAnalytics = unstable_cache(
  async (
    userId: string,
    novels: Novel[]
  ): Promise<{
    analytics: ReadingAnalytics | null;
    dailyActivity: DailyActivity[];
    velocity: ReadingVelocity | null;
  }> => {
    if (novels.length === 0) {
      return { analytics: null, dailyActivity: [], velocity: null };
    }

    const chapterVisits = await getChapterVisitsForAnalytics(userId, novels);

    if (chapterVisits.length === 0) {
      return { analytics: null, dailyActivity: [], velocity: null };
    }

    const analytics = computeReadingAnalytics(chapterVisits);
    const dailyActivity = computeDailyActivity(chapterVisits);
    const velocity = computeReadingVelocity(dailyActivity);

    return { analytics, dailyActivity, velocity };
  },
  ["dashboard-analytics"],
  { revalidate: 300, tags: ["reading-stats"] } // 5 minutes
);

// ─── Main Dashboard Loader ──────────────────────────────────────────────────

/**
 * Loads all dashboard data with intelligent caching.
 *
 * Caching strategy:
 * - Novels list: 60s cache (changes on upload/delete only)
 * - Analytics: 5min cache (historical data, expensive to compute)
 * - Progress/bookmarks: no cache (real-time, cheap queries)
 * - Recently read: no cache (real-time for "continue reading")
 *
 * This reduces the typical dashboard load from 5+ sequential DB queries
 * to mostly cached reads, with only 3 real-time queries when cache is warm.
 */
export async function loadDashboardData(userId: string): Promise<DashboardData> {
  // 1. Fetch novels (cached)
  const novels = await getCachedNovels(userId);

  if (novels.length === 0) {
    return {
      novels: [],
      progressMap: new Map(),
      bookmarkCountMap: new Map(),
      analytics: null,
      dailyActivity: [],
      velocity: null,
      recentlyRead: [],
    };
  }

  const novelIds = novels.map((n) => n.id);

  // 2. Parallel fetch: real-time data + cached analytics
  const [progressMap, bookmarkCountMap, analyticsData, recentlyRead] = await Promise.all([
    getReadingProgressBatch(userId, novelIds),
    getBookmarkCountsBatch(userId, novelIds),
    getCachedAnalytics(userId, novels),
    getRecentlyReadNovels(userId),
  ]);

  return {
    novels,
    progressMap,
    bookmarkCountMap,
    analytics: analyticsData.analytics,
    dailyActivity: analyticsData.dailyActivity,
    velocity: analyticsData.velocity,
    recentlyRead,
  };
}

// ─── Cache Invalidation Helpers ─────────────────────────────────────────────

import { revalidateTag } from "next/cache";

/**
 * Invalidate the novels cache when novels are created/deleted.
 * Uses "max" profile to invalidate across all cache lifetimes.
 */
export function invalidateNovelsCache() {
  revalidateTag("novels", "max");
}

/**
 * Invalidate reading stats cache after significant reading activity.
 * Uses "max" profile to invalidate across all cache lifetimes.
 */
export function invalidateReadingStatsCache() {
  revalidateTag("reading-stats", "max");
}

// Usage in API routes:
// import { invalidateNovelsCache, invalidateReadingStatsCache } from "@/app/lib/dashboard-cache";
// invalidateNovelsCache();  // After novel upload/delete
// invalidateReadingStatsCache();  // After significant reading activity
