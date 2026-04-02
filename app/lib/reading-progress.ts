import { prisma } from "./prisma";

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

export async function getReadingProgressBatch(
  userId: string,
  novelIds: string[]
): Promise<Map<string, { lastChapterIndex: number; totalVisited: number }>> {
  if (novelIds.length === 0) return new Map();

  const progressList = await prisma.readingProgress.findMany({
    where: { userId, novelId: { in: novelIds } },
    select: {
      novelId: true,
      lastChapterIndex: true,
      _count: {
        select: { chapterVisits: true },
      },
    },
  });

  const map = new Map<
    string,
    { lastChapterIndex: number; totalVisited: number }
  >();

  for (const p of progressList) {
    map.set(p.novelId, {
      lastChapterIndex: p.lastChapterIndex,
      totalVisited: p._count.chapterVisits,
    });
  }

  return map;
}
