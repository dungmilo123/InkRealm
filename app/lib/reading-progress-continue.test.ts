import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { prisma } from "@/app/lib/prisma";
import { getContinueReadingNovel } from "@/app/lib/reading-progress";

// ─── Test fixtures ─────────────────────────────────────────────────
const TEST_USER_ID = "continue-reading-test-user";
const TEST_NOVEL_A = "continue-reading-test-novel-a";
const TEST_NOVEL_B = "continue-reading-test-novel-b";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Helper: simulate a chapter visit (same as recordChapterVisit but allows
 * controlling timestamps for deterministic ordering in tests).
 */
async function createVisitAtTime(
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
      email: `continue-reading-${uniqueSuffix()}@test.local`,
      name: "Continue Reading Test User",
    },
  });

  for (const novelId of [TEST_NOVEL_A, TEST_NOVEL_B]) {
    await prisma.novel.upsert({
      where: { id: novelId },
      update: {},
      create: {
        id: novelId,
        title: `Continue Test Novel ${novelId.slice(-1).toUpperCase()}`,
        originalFileName: "test.txt",
        fileType: "txt",
        mimeType: "text/plain",
        sizeBytes: 200,
        chapterCount: 10,
        storagePath: `/tmp/continue-reading-test-${novelId}`,
        userId: TEST_USER_ID,
      },
    });
  }
});

after(async () => {
  // Clean up in FK order: visits → progress → novels → user
  await prisma.chapterVisit.deleteMany({
    where: { readingProgress: { userId: TEST_USER_ID } },
  });
  await prisma.readingProgress.deleteMany({
    where: { userId: TEST_USER_ID },
  });
  await prisma.novel.deleteMany({
    where: { id: { in: [TEST_NOVEL_A, TEST_NOVEL_B] } },
  });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

// ─── getContinueReadingNovel ──────────────────────────────────────

describe("getContinueReadingNovel", () => {
  it("returns null for a user with no reading history", async () => {
    const result = await getContinueReadingNovel("nonexistent-user-id");
    assert.equal(result, null);
  });

  describe("with reading history", () => {
    before(async () => {
      // Novel A: read chapters 1, 2, 3 — earlier timestamps
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_A,
        1,
        new Date("2026-03-01T10:00:00Z")
      );
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_A,
        2,
        new Date("2026-03-01T11:00:00Z")
      );
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_A,
        3,
        new Date("2026-03-01T12:00:00Z")
      );

      // Novel B: read chapter 1 — later timestamp (most recent)
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_B,
        1,
        new Date("2026-03-02T14:00:00Z")
      );
    });

    after(async () => {
      await prisma.chapterVisit.deleteMany({
        where: { readingProgress: { userId: TEST_USER_ID } },
      });
      await prisma.readingProgress.deleteMany({
        where: { userId: TEST_USER_ID },
      });
    });

    it("returns the most recently read novel", async () => {
      const result = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(result !== null, "result should not be null");
      assert.equal(result.novel.id, TEST_NOVEL_B);
    });

    it("returns correct novel metadata", async () => {
      const result = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(result !== null);

      assert.equal(typeof result.novel.id, "string");
      assert.equal(typeof result.novel.title, "string");
      assert.equal(result.novel.fileType, "txt");
      assert.equal(result.novel.chapterCount, 10);
    });

    it("returns the lastChapterIndex of the most recent novel", async () => {
      const result = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(result !== null);
      // Novel B had chapter 1 visited
      assert.equal(result.lastChapterIndex, 1);
    });

    it("returns correct totalVisited count (chapter visits for that novel)", async () => {
      const result = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(result !== null);
      // Novel B has 1 chapter visit
      assert.equal(result.totalVisited, 1);
    });

    it("returns lastReadAt as a Date", async () => {
      const result = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(result !== null);
      assert.ok(result.lastReadAt instanceof Date, "lastReadAt should be a Date");
      assert.ok(
        !isNaN(result.lastReadAt.getTime()),
        "lastReadAt should be a valid date"
      );
    });
  });

  describe("recency ordering", () => {
    before(async () => {
      // Read novel A first, then novel B
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_A,
        1,
        new Date("2026-03-10T10:00:00Z")
      );
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_B,
        1,
        new Date("2026-03-10T11:00:00Z")
      );
    });

    after(async () => {
      await prisma.chapterVisit.deleteMany({
        where: { readingProgress: { userId: TEST_USER_ID } },
      });
      await prisma.readingProgress.deleteMany({
        where: { userId: TEST_USER_ID },
      });
    });

    it("updates recency when a previously-read novel is read again", async () => {
      // Novel B was most recent
      const before = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(before !== null);
      assert.equal(before.novel.id, TEST_NOVEL_B, "Novel B should be most recent initially");

      // Now read novel A again (later visit)
      await createVisitAtTime(
        TEST_USER_ID,
        TEST_NOVEL_A,
        2,
        new Date("2026-03-10T15:00:00Z")
      );

      const afterResult = await getContinueReadingNovel(TEST_USER_ID);
      assert.ok(afterResult !== null);
      assert.equal(
        afterResult.novel.id,
        TEST_NOVEL_A,
        "Novel A should be most recent after new visit"
      );
      assert.equal(afterResult.lastChapterIndex, 2);
      assert.equal(afterResult.totalVisited, 2, "Novel A now has 2 visits (ch 1 + ch 2)");
    });
  });

  describe("user isolation", () => {
    const OTHER_USER_ID = "continue-reading-other-user";

    before(async () => {
      await prisma.user.upsert({
        where: { id: OTHER_USER_ID },
        update: {},
        create: {
          id: OTHER_USER_ID,
          email: `continue-other-${uniqueSuffix()}@test.local`,
          name: "Other User",
        },
      });

      // Other user reads novel A
      await createVisitAtTime(
        OTHER_USER_ID,
        TEST_NOVEL_A,
        5,
        new Date("2026-04-01T10:00:00Z")
      );
    });

    after(async () => {
      await prisma.chapterVisit.deleteMany({
        where: { readingProgress: { userId: OTHER_USER_ID } },
      });
      await prisma.readingProgress.deleteMany({
        where: { userId: OTHER_USER_ID },
      });
      await prisma.user.deleteMany({ where: { id: OTHER_USER_ID } });
    });

    it("does not return another user's reading progress", async () => {
      const result = await getContinueReadingNovel(OTHER_USER_ID);
      assert.ok(result !== null);
      // Other user only has novel A at chapter 5
      assert.equal(result.novel.id, TEST_NOVEL_A);
      assert.equal(result.lastChapterIndex, 5);
      assert.equal(result.totalVisited, 1);
    });
  });
});
