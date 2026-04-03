import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { prisma } from "@/app/lib/prisma";
import {
  toggleBookmark,
  updateBookmarkNote,
  isChapterBookmarked,
  getBookmarksForNovel,
  getBookmarkCountsBatch,
  getBookmarkedChapterIndices,
} from "@/app/lib/bookmarks";

// ─── Test fixtures ─────────────────────────────────────────────────
const TEST_USER_ID = "bookmark-test-user";
const TEST_NOVEL_ID_1 = "bookmark-test-novel-1";
const TEST_NOVEL_ID_2 = "bookmark-test-novel-2";

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Set up test user and novels before all tests; clean up after.
before(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: `bookmark-test-${uniqueSuffix()}@test.local`,
      name: "Bookmark Test User",
    },
  });

  for (const novelId of [TEST_NOVEL_ID_1, TEST_NOVEL_ID_2]) {
    await prisma.novel.upsert({
      where: { id: novelId },
      update: {},
      create: {
        id: novelId,
        title: `Bookmark Test Novel ${novelId.slice(-1)}`,
        originalFileName: "test.txt",
        fileType: "txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        storagePath: `/tmp/bookmark-test-${novelId}`,
        userId: TEST_USER_ID,
      },
    });
  }
});

after(async () => {
  // Clean up all bookmarks first (FK constraint), then novels, then user
  await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.novel.deleteMany({
    where: { id: { in: [TEST_NOVEL_ID_1, TEST_NOVEL_ID_2] } },
  });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

// ─── toggleBookmark ────────────────────────────────────────────────

describe("toggleBookmark", () => {
  after(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("creates a bookmark when none exists", async () => {
    const result = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 0);
    assert.notEqual(result, null);
    assert.equal(result!.chapterIndex, 0);
    assert.equal(result!.note, null);
    assert.ok(result!.id);
    assert.ok(result!.createdAt instanceof Date);
  });

  it("removes a bookmark on second toggle (same chapter)", async () => {
    // First toggle: create
    const created = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 5);
    assert.notEqual(created, null);

    // Second toggle: remove
    const removed = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 5);
    assert.equal(removed, null);

    // Verify it's actually gone from the database
    const exists = await prisma.bookmark.findUnique({
      where: {
        userId_novelId_chapterIndex: {
          userId: TEST_USER_ID,
          novelId: TEST_NOVEL_ID_1,
          chapterIndex: 5,
        },
      },
    });
    assert.equal(exists, null);
  });

  it("third toggle re-creates the bookmark", async () => {
    // Toggle 1: create
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 10);
    // Toggle 2: remove
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 10);
    // Toggle 3: re-create
    const result = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 10);
    assert.notEqual(result, null);
    assert.equal(result!.chapterIndex, 10);
  });

  it("stores an optional note when creating", async () => {
    const result = await toggleBookmark(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      20,
      "Important chapter!"
    );
    assert.notEqual(result, null);
    assert.equal(result!.note, "Important chapter!");
  });

  it("handles different chapters independently", async () => {
    const ch1 = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 30);
    const ch2 = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 31);
    assert.notEqual(ch1, null);
    assert.notEqual(ch2, null);
    assert.notEqual(ch1!.id, ch2!.id);

    // Removing one doesn't affect the other
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 30);
    const ch2Still = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      31
    );
    assert.equal(ch2Still, true);
  });
});

// ─── updateBookmarkNote ────────────────────────────────────────────

describe("updateBookmarkNote", () => {
  let bookmarkId: string;

  before(async () => {
    const bookmark = await toggleBookmark(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      100
    );
    assert.notEqual(bookmark, null);
    bookmarkId = bookmark!.id;
  });

  after(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("sets a note on a bookmark", async () => {
    const updated = await updateBookmarkNote(
      TEST_USER_ID,
      bookmarkId,
      "My note"
    );
    assert.equal(updated.note, "My note");
    assert.equal(updated.id, bookmarkId);
  });

  it("clears a note when set to null", async () => {
    const updated = await updateBookmarkNote(TEST_USER_ID, bookmarkId, null);
    assert.equal(updated.note, null);
  });

  it("throws for non-existent bookmark", async () => {
    await assert.rejects(
      () => updateBookmarkNote(TEST_USER_ID, "nonexistent-id", "note"),
      (error: Error) => {
        assert.match(error.message, /not found/i);
        return true;
      }
    );
  });

  it("throws when bookmark belongs to another user", async () => {
    // Create a second user
    const otherUserId = "bookmark-test-other-user";
    await prisma.user.upsert({
      where: { id: otherUserId },
      update: {},
      create: {
        id: otherUserId,
        email: `bookmark-other-${uniqueSuffix()}@test.local`,
        name: "Other User",
      },
    });

    try {
      await assert.rejects(
        () => updateBookmarkNote(otherUserId, bookmarkId, "hijack"),
        (error: Error) => {
          assert.match(error.message, /not found/i);
          return true;
        }
      );
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
    }
  });
});

// ─── isChapterBookmarked ───────────────────────────────────────────

describe("isChapterBookmarked", () => {
  before(async () => {
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 200);
  });

  after(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns true for a bookmarked chapter", async () => {
    const result = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      200
    );
    assert.equal(result, true);
  });

  it("returns false for a non-bookmarked chapter", async () => {
    const result = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      999
    );
    assert.equal(result, false);
  });

  it("returns false for a different novel", async () => {
    const result = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_2,
      200
    );
    assert.equal(result, false);
  });
});

// ─── getBookmarksForNovel ──────────────────────────────────────────

describe("getBookmarksForNovel", () => {
  before(async () => {
    // Create bookmarks at chapters 3, 1, 7 (out of order)
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 3, "Third chapter");
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 1, null);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 7, "Lucky seven");
  });

  after(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns all bookmarks for a novel", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    assert.equal(bookmarks.length, 3);
  });

  it("returns bookmarks ordered by chapter index ascending", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    assert.deepEqual(
      bookmarks.map((b) => b.chapterIndex),
      [1, 3, 7]
    );
  });

  it("preserves notes", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    const byChapter = new Map(bookmarks.map((b) => [b.chapterIndex, b.note]));
    assert.equal(byChapter.get(3), "Third chapter");
    assert.equal(byChapter.get(1), null);
    assert.equal(byChapter.get(7), "Lucky seven");
  });

  it("returns empty array for novel with no bookmarks", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_2
    );
    assert.deepEqual(bookmarks, []);
  });

  it("does not leak bookmarks from other novels", async () => {
    // Add a bookmark in novel 2
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_2, 0);

    const novel1Bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    const novel2Bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_2
    );

    // Novel 1 should still have exactly 3, novel 2 should have 1
    assert.equal(novel1Bookmarks.length, 3);
    assert.equal(novel2Bookmarks.length, 1);
    assert.equal(novel2Bookmarks[0].chapterIndex, 0);
  });
});

// ─── getBookmarkCountsBatch ────────────────────────────────────────

describe("getBookmarkCountsBatch", () => {
  before(async () => {
    // Novel 1: 3 bookmarks
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 0);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 1);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 2);

    // Novel 2: 1 bookmark
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_2, 5);
  });

  after(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns counts for multiple novels in one query", async () => {
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, [
      TEST_NOVEL_ID_1,
      TEST_NOVEL_ID_2,
    ]);
    assert.equal(counts.get(TEST_NOVEL_ID_1), 3);
    assert.equal(counts.get(TEST_NOVEL_ID_2), 1);
  });

  it("omits novels with zero bookmarks from the map", async () => {
    const fakeNovelId = "nonexistent-novel-id";
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, [
      TEST_NOVEL_ID_1,
      fakeNovelId,
    ]);
    assert.equal(counts.has(fakeNovelId), false);
    assert.equal(counts.get(TEST_NOVEL_ID_1), 3);
  });

  it("returns empty map for empty input", async () => {
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, []);
    assert.equal(counts.size, 0);
  });

  it("returns a Map (not a plain object)", async () => {
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, [
      TEST_NOVEL_ID_1,
    ]);
    assert.ok(counts instanceof Map);
  });
});

// ─── getBookmarkedChapterIndices ───────────────────────────────────

describe("getBookmarkedChapterIndices", () => {
  before(async () => {
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 2);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 5);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 11);
  });

  after(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns a Set of chapter indices", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    assert.ok(indices instanceof Set);
    assert.equal(indices.size, 3);
    assert.equal(indices.has(2), true);
    assert.equal(indices.has(5), true);
    assert.equal(indices.has(11), true);
  });

  it("does not include non-bookmarked chapters", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    assert.equal(indices.has(0), false);
    assert.equal(indices.has(99), false);
  });

  it("returns empty set for novel with no bookmarks", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_2
    );
    assert.equal(indices.size, 0);
  });

  it("enables O(1) lookups (Set.has)", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    // This tests the contract: the return type supports .has() for O(1) checks
    // which is the whole reason we return Set instead of array
    assert.equal(typeof indices.has, "function");
    assert.equal(indices.has(5), true);
    assert.equal(indices.has(999), false);
  });
});
