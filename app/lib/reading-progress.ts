import { prisma } from "./prisma";

/**
 * Records that a user visited a specific chapter.
 * Creates or updates the ReadingProgress (with `lastChapterIndex`) and
 * upserts a ChapterVisit timestamp — all inside a transaction.
 */
export async function recordChapterVisit(
  userId: string,
  novelId: string,
  chapterIndex: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const progress = await tx.readingProgress.upsert({
      where: { userId_novelId: { userId, novelId } },
      create: { userId, novelId, lastChapterIndex: chapterIndex },
      update: { lastChapterIndex: chapterIndex },
    });

    await tx.chapterVisit.upsert({
      where: {
        readingProgressId_chapterIndex: {
          readingProgressId: progress.id,
          chapterIndex,
        },
      },
      create: {
        readingProgressId: progress.id,
        chapterIndex,
        visitedAt: new Date(),
      },
      update: { visitedAt: new Date() },
    });
  });
}

/**
 * Save the reader's scroll position (0–1 ratio) for a specific chapter.
 * Creates the ReadingProgress + ChapterVisit if they don't exist yet.
 */
export async function saveScrollPosition(
  userId: string,
  novelId: string,
  chapterIndex: number,
  scrollPosition: number
): Promise<void> {
  const clamped = Math.min(1, Math.max(0, scrollPosition));

  const progress = await prisma.readingProgress.upsert({
    where: { userId_novelId: { userId, novelId } },
    create: { userId, novelId, lastChapterIndex: chapterIndex },
    update: {},
    select: { id: true },
  });

  await prisma.chapterVisit.upsert({
    where: {
      readingProgressId_chapterIndex: {
        readingProgressId: progress.id,
        chapterIndex,
      },
    },
    create: {
      readingProgressId: progress.id,
      chapterIndex,
      scrollPosition: clamped,
      visitedAt: new Date(),
    },
    update: { scrollPosition: clamped },
  });
}

/**
 * Load the saved scroll position for a specific chapter.
 * Returns a 0–1 ratio, or null if no position was saved.
 */
export async function getScrollPosition(
  userId: string,
  novelId: string,
  chapterIndex: number
): Promise<number | null> {
  const progress = await prisma.readingProgress.findUnique({
    where: { userId_novelId: { userId, novelId } },
    select: { id: true },
  });

  if (!progress) return null;

  const visit = await prisma.chapterVisit.findUnique({
    where: {
      readingProgressId_chapterIndex: {
        readingProgressId: progress.id,
        chapterIndex,
      },
    },
    select: { scrollPosition: true },
  });

  return visit?.scrollPosition ?? null;
}

/**
 * Returns the user's reading progress for a novel: the last chapter opened
 * and the set of all chapter indices ever visited. Returns `null` if the
 * user has never opened this novel.
 */
export async function getReadingProgress(
  userId: string,
  novelId: string
): Promise<{
  lastChapterIndex: number;
  visitedChapterIndices: number[];
} | null> {
  const progress = await prisma.readingProgress.findUnique({
    where: { userId_novelId: { userId, novelId } },
    include: { chapterVisits: { select: { chapterIndex: true } } },
  });

  if (!progress) return null;

  return {
    lastChapterIndex: progress.lastChapterIndex,
    visitedChapterIndices: progress.chapterVisits.map((v) => v.chapterIndex),
  };
}

/**
 * Batch-loads reading progress for multiple novels in a single query.
 * Used by the dashboard to show per-novel progress badges without N+1.
 * Returns a Map keyed by novelId with `lastChapterIndex`, `totalVisited`, and `updatedAt`.
 */
export async function getReadingProgressBatch(
  userId: string,
  novelIds: string[]
): Promise<Map<string, { lastChapterIndex: number; totalVisited: number; updatedAt: Date }>> {
  if (novelIds.length === 0) return new Map();

  const progressList = await prisma.readingProgress.findMany({
    where: { userId, novelId: { in: novelIds } },
    select: {
      novelId: true,
      lastChapterIndex: true,
      updatedAt: true,
      _count: {
        select: { chapterVisits: true },
      },
    },
  });

  const map = new Map<
    string,
    { lastChapterIndex: number; totalVisited: number; updatedAt: Date }
  >();

  for (const p of progressList) {
    map.set(p.novelId, {
      lastChapterIndex: p.lastChapterIndex,
      totalVisited: p._count.chapterVisits,
      updatedAt: p.updatedAt,
    });
  }

  return map;
}

/**
 * Returns the novel the user most recently read, along with the chapter
 * they were on and how many chapters they've visited. Used by the dashboard
 * "Continue Reading" banner.
 *
 * Returns `null` if the user has never opened any novel.
 */
export async function getContinueReadingNovel(
  userId: string
): Promise<{
  novel: {
    id: string;
    title: string;
    fileType: string;
    chapterCount: number | null;
  };
  lastChapterIndex: number;
  totalVisited: number;
  lastReadAt: Date;
} | null> {
  const progress = await prisma.readingProgress.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      lastChapterIndex: true,
      updatedAt: true,
      novel: {
        select: {
          id: true,
          title: true,
          fileType: true,
          chapterCount: true,
        },
      },
      _count: {
        select: { chapterVisits: true },
      },
    },
  });

  if (!progress) return null;

  return {
    novel: progress.novel,
    lastChapterIndex: progress.lastChapterIndex,
    totalVisited: progress._count.chapterVisits,
    lastReadAt: progress.updatedAt,
  };
}
