// app/lib/reading-stats-data.ts
// Server-only data access for reading statistics.
// Queries ChapterVisit records and joins with word counts from the reader service
// to produce ChapterVisitData[] consumable by the pure lib/reading-stats.ts functions.

import { prisma } from "./prisma";
import { getReaderSummary } from "./reader/service";
import type { Novel } from "@/app/generated/prisma/client";
import type { ChapterVisitData } from "@/lib/reading-stats";

/**
 * Fetches all chapter visits for a user across all novels, enriched with
 * per-chapter word counts from the reader service.
 *
 * This is the bridge between the DB (visit timestamps) and the pure analytics
 * functions in `lib/reading-stats.ts` (which need word counts).
 *
 * Strategy:
 * 1. Query all ChapterVisit rows for the user (via ReadingProgress join)
 * 2. For each novel, call getReaderSummary() to get per-chapter word counts
 *    (cached by the reader service — not re-parsing files on every call)
 * 3. Merge into ChapterVisitData[] that the pure functions consume
 *
 * @param userId The authenticated user's ID
 * @param novels The user's novel list (already fetched by the dashboard page)
 */
export async function getChapterVisitsForAnalytics(
  userId: string,
  novels: Novel[]
): Promise<ChapterVisitData[]> {
  if (novels.length === 0) return [];

  // 1. Fetch all chapter visits for this user in one query
  const visits = await prisma.chapterVisit.findMany({
    where: {
      readingProgress: { userId },
    },
    select: {
      chapterIndex: true,
      visitedAt: true,
      readingProgress: {
        select: { novelId: true },
      },
    },
    orderBy: { visitedAt: "desc" },
  });

  if (visits.length === 0) return [];

  // 2. Build per-chapter word count lookups from reader summaries.
  //    Only fetch summaries for novels that have visits (avoid unnecessary file I/O).
  const novelIdsWithVisits = new Set(visits.map((v) => v.readingProgress.novelId));
  const novelMap = new Map(novels.map((n) => [n.id, n]));

  // Map<novelId, Map<chapterIndex, wordCount>>
  const wordCountsByNovel = new Map<string, Map<number, number>>();

  const summaryPromises: Promise<void>[] = [];

  for (const novelId of novelIdsWithVisits) {
    const novel = novelMap.get(novelId);
    if (!novel) continue;

    summaryPromises.push(
      getReaderSummary(novel)
        .then((summary) => {
          if (summary.chapters) {
            const chapterWordCounts = new Map<number, number>();
            for (const ch of summary.chapters) {
              chapterWordCounts.set(ch.index, ch.wordCount);
            }
            wordCountsByNovel.set(novelId, chapterWordCounts);
          }
        })
        .catch(() => {
          // Novel file may be missing/corrupt — skip word counts for this novel.
          // Visits still count for streak/activity calculations (with wordCount = 0).
        })
    );
  }

  await Promise.all(summaryPromises);

  // 3. Merge visits with word counts
  return visits.map((v) => ({
    chapterIndex: v.chapterIndex,
    visitedAt: v.visitedAt.toISOString(),
    wordCount:
      wordCountsByNovel.get(v.readingProgress.novelId)?.get(v.chapterIndex) ?? 0,
  }));
}

/**
 * Lightweight version: fetches only visit timestamps (no word counts).
 * Useful when you only need streak/activity data and want to skip file I/O.
 *
 * @param userId The authenticated user's ID
 */
export async function getVisitTimestamps(
  userId: string
): Promise<string[]> {
  const visits = await prisma.chapterVisit.findMany({
    where: {
      readingProgress: { userId },
    },
    select: { visitedAt: true },
    orderBy: { visitedAt: "desc" },
  });

  return visits.map((v) => v.visitedAt.toISOString());
}

/**
 * Fetches chapter visits for a single novel, enriched with word counts.
 * Used by the novel detail page for per-novel reading stats.
 *
 * @param userId The authenticated user's ID
 * @param novel The novel to get stats for (must belong to the user)
 */
export async function getNovelChapterVisitsForStats(
  userId: string,
  novel: Novel
): Promise<ChapterVisitData[]> {
  const progress = await prisma.readingProgress.findUnique({
    where: { userId_novelId: { userId, novelId: novel.id } },
    select: { id: true },
  });

  if (!progress) return [];

  const visits = await prisma.chapterVisit.findMany({
    where: { readingProgressId: progress.id },
    select: {
      chapterIndex: true,
      visitedAt: true,
    },
    orderBy: { visitedAt: "desc" },
  });

  if (visits.length === 0) return [];

  // Get word counts from reader summary (cached)
  const chapterWordCounts = new Map<number, number>();
  try {
    const summary = await getReaderSummary(novel);
    if (summary.chapters) {
      for (const ch of summary.chapters) {
        chapterWordCounts.set(ch.index, ch.wordCount);
      }
    }
  } catch {
    // File missing/corrupt — return visits with zero word counts
  }

  return visits.map((v) => ({
    chapterIndex: v.chapterIndex,
    visitedAt: v.visitedAt.toISOString(),
    wordCount: chapterWordCounts.get(v.chapterIndex) ?? 0,
  }));
}
