import "dotenv/config";
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
beforeAll(async () => {
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

afterAll(async () => {
  // Clean up all bookmarks first (FK constraint), then novels, then user
  await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.novel.deleteMany({
    where: { id: { in: [TEST_NOVEL_ID_1, TEST_NOVEL_ID_2] } },
  });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

// ─── toggleBookmark ────────────────────────────────────────────────

describe("toggleBookmark", () => {
  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("creates a bookmark when none exists", async () => {
    const result = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 0);
    expect(result).not.toBe(null);
    expect(result!.chapterIndex).toBe(0);
    expect(result!.note).toBe(null);
    expect(result!.id).toBeTruthy();
    expect(result!.createdAt instanceof Date).toBeTruthy();
  });

  it("removes a bookmark on second toggle (same chapter)", async () => {
    // First toggle: create
    const created = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 5);
    expect(created).not.toBe(null);

    // Second toggle: remove
    const removed = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 5);
    expect(removed).toBe(null);

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
    expect(exists).toBe(null);
  });

  it("third toggle re-creates the bookmark", async () => {
    // Toggle 1: create
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 10);
    // Toggle 2: remove
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 10);
    // Toggle 3: re-create
    const result = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 10);
    expect(result).not.toBe(null);
    expect(result!.chapterIndex).toBe(10);
  });

  it("stores an optional note when creating", async () => {
    const result = await toggleBookmark(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      20,
      "Important chapter!"
    );
    expect(result).not.toBe(null);
    expect(result!.note).toBe("Important chapter!");
  });

  it("handles different chapters independently", async () => {
    const ch1 = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 30);
    const ch2 = await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 31);
    expect(ch1).not.toBe(null);
    expect(ch2).not.toBe(null);
    expect(ch1!.id).not.toBe(ch2!.id);

    // Removing one doesn't affect the other
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 30);
    const ch2Still = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      31
    );
    expect(ch2Still).toBe(true);
  });
});

// ─── updateBookmarkNote ────────────────────────────────────────────

describe("updateBookmarkNote", () => {
  let bookmarkId: string;

  beforeAll(async () => {
    const bookmark = await toggleBookmark(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      100
    );
    expect(bookmark).not.toBe(null);
    bookmarkId = bookmark!.id;
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("sets a note on a bookmark", async () => {
    const updated = await updateBookmarkNote(
      TEST_USER_ID,
      bookmarkId,
      "My note"
    );
    expect(updated.note).toBe("My note");
    expect(updated.id).toBe(bookmarkId);
  });

  it("clears a note when set to null", async () => {
    const updated = await updateBookmarkNote(TEST_USER_ID, bookmarkId, null);
    expect(updated.note).toBe(null);
  });

  it("throws for non-existent bookmark", async () => {
    await expect(
      () => updateBookmarkNote(TEST_USER_ID, "nonexistent-id", "note"),
    ).rejects.toThrow(/not found/i);
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
      await expect(
        () => updateBookmarkNote(otherUserId, bookmarkId, "hijack"),
      ).rejects.toThrow(/not found/i);
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
    }
  });
});

// ─── isChapterBookmarked ───────────────────────────────────────────

describe("isChapterBookmarked", () => {
  beforeAll(async () => {
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 200);
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns true for a bookmarked chapter", async () => {
    const result = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      200
    );
    expect(result).toBe(true);
  });

  it("returns false for a non-bookmarked chapter", async () => {
    const result = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_1,
      999
    );
    expect(result).toBe(false);
  });

  it("returns false for a different novel", async () => {
    const result = await isChapterBookmarked(
      TEST_USER_ID,
      TEST_NOVEL_ID_2,
      200
    );
    expect(result).toBe(false);
  });
});

// ─── getBookmarksForNovel ──────────────────────────────────────────

describe("getBookmarksForNovel", () => {
  beforeAll(async () => {
    // Create bookmarks at chapters 3, 1, 7 (out of order)
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 3, "Third chapter");
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 1, null);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 7, "Lucky seven");
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns all bookmarks for a novel", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    expect(bookmarks.length).toBe(3);
  });

  it("returns bookmarks ordered by chapter index ascending", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    expect(bookmarks.map((b) => b.chapterIndex)).toEqual([1, 3, 7]);
  });

  it("preserves notes", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    const byChapter = new Map(bookmarks.map((b) => [b.chapterIndex, b.note]));
    expect(byChapter.get(3)).toBe("Third chapter");
    expect(byChapter.get(1)).toBe(null);
    expect(byChapter.get(7)).toBe("Lucky seven");
  });

  it("returns empty array for novel with no bookmarks", async () => {
    const bookmarks = await getBookmarksForNovel(
      TEST_USER_ID,
      TEST_NOVEL_ID_2
    );
    expect(bookmarks).toEqual([]);
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
    expect(novel1Bookmarks.length).toBe(3);
    expect(novel2Bookmarks.length).toBe(1);
    expect(novel2Bookmarks[0].chapterIndex).toBe(0);
  });
});

// ─── getBookmarkCountsBatch ────────────────────────────────────────

describe("getBookmarkCountsBatch", () => {
  beforeAll(async () => {
    // Novel 1: 3 bookmarks
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 0);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 1);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 2);

    // Novel 2: 1 bookmark
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_2, 5);
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns counts for multiple novels in one query", async () => {
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, [
      TEST_NOVEL_ID_1,
      TEST_NOVEL_ID_2,
    ]);
    expect(counts.get(TEST_NOVEL_ID_1)).toBe(3);
    expect(counts.get(TEST_NOVEL_ID_2)).toBe(1);
  });

  it("omits novels with zero bookmarks from the map", async () => {
    const fakeNovelId = "nonexistent-novel-id";
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, [
      TEST_NOVEL_ID_1,
      fakeNovelId,
    ]);
    expect(counts.has(fakeNovelId)).toBe(false);
    expect(counts.get(TEST_NOVEL_ID_1)).toBe(3);
  });

  it("returns empty map for empty input", async () => {
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, []);
    expect(counts.size).toBe(0);
  });

  it("returns a Map (not a plain object)", async () => {
    const counts = await getBookmarkCountsBatch(TEST_USER_ID, [
      TEST_NOVEL_ID_1,
    ]);
    expect(counts instanceof Map).toBeTruthy();
  });
});

// ─── getBookmarkedChapterIndices ───────────────────────────────────

describe("getBookmarkedChapterIndices", () => {
  beforeAll(async () => {
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 2);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 5);
    await toggleBookmark(TEST_USER_ID, TEST_NOVEL_ID_1, 11);
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  it("returns a Set of chapter indices", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    expect(indices instanceof Set).toBeTruthy();
    expect(indices.size).toBe(3);
    expect(indices.has(2)).toBe(true);
    expect(indices.has(5)).toBe(true);
    expect(indices.has(11)).toBe(true);
  });

  it("does not include non-bookmarked chapters", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    expect(indices.has(0)).toBe(false);
    expect(indices.has(99)).toBe(false);
  });

  it("returns empty set for novel with no bookmarks", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_2
    );
    expect(indices.size).toBe(0);
  });

  it("enables O(1) lookups (Set.has)", async () => {
    const indices = await getBookmarkedChapterIndices(
      TEST_USER_ID,
      TEST_NOVEL_ID_1
    );
    // This tests the contract: the return type supports .has() for O(1) checks
    // which is the whole reason we return Set instead of array
    expect(typeof indices.has).toBe("function");
    expect(indices.has(5)).toBe(true);
    expect(indices.has(999)).toBe(false);
  });
});
