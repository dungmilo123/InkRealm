import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
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

before(async () => {
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

after(async () => {
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
  before(async () => {
    // Create visits across two novels on different dates
    const day1 = new Date("2026-03-01T10:00:00Z");
    const day2 = new Date("2026-03-02T14:00:00Z");
    const day3 = new Date("2026-03-03T09:00:00Z");

    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 1, day1);
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 2, day2);
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID_2, 1, day3);
  });

  after(async () => {
    await prisma.chapterVisit.deleteMany({
      where: { readingProgress: { userId: TEST_USER_ID } },
    });
    await prisma.readingProgress.deleteMany({
      where: { userId: TEST_USER_ID },
    });
  });

  it("returns ISO timestamps for all visits across all novels", async () => {
    const timestamps = await getVisitTimestamps(TEST_USER_ID);
    assert.equal(timestamps.length, 3);

    // Each timestamp should be a valid ISO string
    for (const ts of timestamps) {
      assert.ok(!isNaN(new Date(ts).getTime()), `"${ts}" is not a valid ISO date`);
    }
  });

  it("returns timestamps in descending order (newest first)", async () => {
    const timestamps = await getVisitTimestamps(TEST_USER_ID);
    for (let i = 1; i < timestamps.length; i++) {
      const prev = new Date(timestamps[i - 1]).getTime();
      const curr = new Date(timestamps[i]).getTime();
      assert.ok(prev >= curr, "timestamps should be in descending order");
    }
  });

  it("returns empty array for user with no visits", async () => {
    const timestamps = await getVisitTimestamps("nonexistent-user-id");
    assert.deepEqual(timestamps, []);
  });
});

// ─── getNovelChapterVisitsForStats ─────────────────────────────────

describe("getNovelChapterVisitsForStats", () => {
  before(async () => {
    const day1 = new Date("2026-03-10T10:00:00Z");
    const day2 = new Date("2026-03-11T14:00:00Z");

    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 1, day1);
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID, 3, day2);
    // Different novel — should not appear
    await createVisit(TEST_USER_ID, TEST_NOVEL_ID_2, 1, day1);
  });

  after(async () => {
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

    assert.equal(visits.length, 2);
    const indices = visits.map((v) => v.chapterIndex).sort();
    assert.deepEqual(indices, [1, 3]);
  });

  it("returns ChapterVisitData shape with required fields", async () => {
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    const visits = await getNovelChapterVisitsForStats(TEST_USER_ID, novel);

    for (const visit of visits) {
      assert.ok(typeof visit.chapterIndex === "number", "chapterIndex is number");
      assert.ok(typeof visit.visitedAt === "string", "visitedAt is string");
      assert.ok(!isNaN(new Date(visit.visitedAt).getTime()), "visitedAt is valid ISO");
      assert.ok(typeof visit.wordCount === "number", "wordCount is number");
      assert.ok(visit.wordCount >= 0, "wordCount is non-negative");
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
      assert.ok(prev >= curr, "visits should be in descending order");
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
    assert.deepEqual(visits, []);
  });

  it("gracefully handles missing novel files (wordCount falls back to 0)", async () => {
    // Test novel points to /tmp/reading-stats-test-... which doesn't exist
    // The function should still return visits with wordCount = 0
    const novel = await prisma.novel.findUniqueOrThrow({
      where: { id: TEST_NOVEL_ID },
    });
    const visits = await getNovelChapterVisitsForStats(TEST_USER_ID, novel);

    assert.ok(visits.length > 0, "should still return visits");
    for (const v of visits) {
      assert.equal(v.wordCount, 0, "wordCount should be 0 for missing files");
    }
  });
});
