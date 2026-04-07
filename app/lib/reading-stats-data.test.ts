import "dotenv/config";
import { prisma } from "@/app/lib/prisma";
import {
  getVisitTimestamps,
  getNovelChapterVisitsForStats,
} from "@/app/lib/reading-stats-data";

// ─── Test fixtures ─────────────────────────────────────────────────
const TEST_USER_ID = "reading-stats-test-user";
const TEST_NOVEL_ID = "reading-stats-test-novel";
const TEST_NOVEL_ID_2 = "reading-stats-test-novel-2";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper: create a chapter visit via ReadingProgress → ChapterVisit
async function createVisit(
  userId: string,
  novelId: string,
  chapterIndex: number,
  visitedAt: Date
) {
  const progress = await prisma.readingProgress.upsert({
    where: { userId_novelId: { userId, novelId } },
    create: { userId, novelId, lastChapterIndex: chapterIndex },
    update: { lastChapterIndex: chapterIndex },
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
      visitedAt,
    },
    update: { visitedAt },
  });
}

// ─── Setup / Teardown ──────────────────────────────────────────────

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: `reading-stats-${uniqueSuffix()}@test.local`,
      name: "Reading Stats Test User",
    },
  });

  for (const novelId of [TEST_NOVEL_ID, TEST_NOVEL_ID_2]) {
    await prisma.novel.upsert({
      where: { id: novelId },
      update: {},
      create: {
        id: novelId,
        title: `Stats Test Novel ${novelId.slice(-1)}`,
        originalFileName: "test.txt",
        fileType: "txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        storagePath: `/tmp/reading-stats-test-${novelId}`,
        userId: TEST_USER_ID,
      },
    });
  }
});

afterAll(async () => {
  // Clean up in FK order: visits → progress → novels → user
  await prisma.chapterVisit.deleteMany({
    where: {
      readingProgress: { userId: TEST_USER_ID },
    },
  });
  await prisma.readingProgress.deleteMany({
    where: { userId: TEST_USER_ID },
  });
  await prisma.novel.deleteMany({
    where: { id: { in: [TEST_NOVEL_ID, TEST_NOVEL_ID_2] } },
  });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

// ─── getVisitTimestamps ────────────────────────────────────────────

describe("getVisitTimestamps", () => {
  beforeAll(async () => {
    // Create visits across two novels on different dates
    const day1 = new Date("2026-03-01T10:00:00Z");
    const day2 = new Date("2026-03-02T14:00:00Z");
    const day3 = new Date("2026-03-03T09:00:00Z");

    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 1, day1);
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 2, day2);
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID_2, 1, day3);
  });

  afterAll(async () => {
    await prisma.chapterVisit.deleteMany({
      where: { readingProgress: { userId: TEST_USER_ID } },
    });
    await prisma.readingProgress.deleteMany({
      where: { userId: TEST_USER_ID },
    });
  });

  it("returns ISO timestamps for all visits across all novels", async () => {
    const timestamps = await getVisitTimestamps(TEST_USER_ID);
    expect(timestamps.length).toBe(3);

    // Each timestamp should be a valid ISO string
    for (const ts of timestamps) {
      expect(isNaN(new Date(ts).getTime())).toBeFalsy();
    }
  });

  it("returns timestamps in descending order (newest first)", async () => {
    const timestamps = await getVisitTimestamps(TEST_USER_ID);
    for (let i = 1; i < timestamps.length; i++) {
      const prev = new Date(timestamps[i - 1]).getTime();
      const curr = new Date(timestamps[i]).getTime();
      expect(prev >= curr, "timestamps should be in descending order").toBeTruthy();
    }
  });

  it("returns empty array for user with no visits", async () => {
    const timestamps = await getVisitTimestamps("nonexistent-user-id");
    expect(timestamps).toEqual([]);
  });
});

// ─── getNovelChapterVisitsForStats ─────────────────────────────────

describe("getNovelChapterVisitsForStats", () => {
  beforeAll(async () => {
    const day1 = new Date("2026-03-10T10:00:00Z");
    const day2 = new Date("2026-03-11T14:00:00Z");

    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 1, day1);
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 3, day2);
    // Different novel — should not appear
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID_2, 1, day1);
  });

  afterAll(async () => {
    await prisma.chapterVisit.deleteMany({
      where: { readingProgress: { userId: TEST_USER_ID } },
    });
    await prisma.readingProgress.deleteMany({
      where: { userId: TEST_USER_ID },
    });
  });

  it("returns only visits for the specified novel", async () => {
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    const visits = await getNovelChapterVisitsForStats(TEST_USER_ID, novel);

    expect(visits.length).toBe(2);
    const indices = visits.map((v) => v.chapterIndex).sort();
    expect(indices).toEqual([1, 3]);
  });

  it("returns ChapterVisitData shape with required fields", async () => {
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    const visits = await getNovelChapterVisitsForStats(TEST_USER_ID, novel);

    for (const visit of visits) {
      expect(typeof visit.chapterIndex === "number", "chapterIndex is number").toBeTruthy();
      expect(typeof visit.visitedAt === "string", "visitedAt is string").toBeTruthy();
      expect(isNaN(new Date(visit.visitedAt).getTime())).toBeFalsy();
      expect(typeof visit.wordCount === "number", "wordCount is number").toBeTruthy();
      expect(visit.wordCount >= 0, "wordCount is non-negative").toBeTruthy();
    }
  });

  it("returns visits in descending order by visitedAt", async () => {
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    const visits = await getNovelChapterVisitsForStats(TEST_USER_ID, novel);

    for (let i = 1; i < visits.length; i++) {
      const prev = new Date(visits[i - 1].visitedAt).getTime();
      const curr = new Date(visits[i].visitedAt).getTime();
      expect(prev >= curr, "visits should be in descending order").toBeTruthy();
    }
  });

  it("returns empty array for novel with no visits", async () => {
    // Create a novel that has never been visited
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    // Use a different user who has no visits
    const visits = await getNovelChapterVisitsForStats(
      "nonexistent-user-id",
      novel
    );
    expect(visits).toEqual([]);
  });

  it("gracefully handles missing novel files (wordCount falls back to 0)", async () => {
    // Test novel points to /tmp/reading-stats-test-... which doesn't exist
    // The function should still return visits with wordCount = 0
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    const visits = await getNovelChapterVisitsForStats(TEST_USER_ID, novel);

    expect(visits.length > 0, "should still return visits").toBeTruthy();
    for (const v of visits) {
      expect(v.wordCount).toBe(0, "wordCount should be 0 for missing files");
    }
  });
});
