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
