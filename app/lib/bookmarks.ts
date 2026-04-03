import { prisma } from "./prisma";

// ─── Types ──────────────────────────────────────────────────────────

export type BookmarkData = {
  id: string;
  chapterIndex: number;
  note: string | null;
  createdAt: Date;
};

// ─── Single-bookmark operations ─────────────────────────────────────

/**
 * Toggle a bookmark on a chapter.
 *
 * If a bookmark already exists for (userId, novelId, chapterIndex), it is
 * deleted and `null` is returned.  Otherwise a new bookmark is created and
 * returned.
 *
 * This toggle semantic keeps the API surface tiny — the reader UI only
 * needs a single button that fires a POST.
 */
export async function toggleBookmark(
  userId: string,
  novelId: string,
  chapterIndex: number,
  note?: string | null
): Promise<BookmarkData | null> {
  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_novelId_chapterIndex: { userId, novelId, chapterIndex },
    },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return null; // bookmark removed
  }

  const created = await prisma.bookmark.create({
    data: { userId, novelId, chapterIndex, note: note ?? null },
  });

  return {
    id: created.id,
    chapterIndex: created.chapterIndex,
    note: created.note,
    createdAt: created.createdAt,
  };
}

/**
 * Update the note on an existing bookmark.
 * Throws if the bookmark does not exist or does not belong to the user.
 */
export async function updateBookmarkNote(
  userId: string,
  bookmarkId: string,
  note: string | null
): Promise<BookmarkData> {
  const bookmark = await prisma.bookmark.findUnique({
    where: { id: bookmarkId },
  });

  if (!bookmark || bookmark.userId !== userId) {
    throw new Error("Bookmark not found");
  }

  const updated = await prisma.bookmark.update({
    where: { id: bookmarkId },
    data: { note },
  });

  return {
    id: updated.id,
    chapterIndex: updated.chapterIndex,
    note: updated.note,
    createdAt: updated.createdAt,
  };
}

// ─── Query operations ───────────────────────────────────────────────

/**
 * Check whether the current chapter is bookmarked.
 * Used by the reader UI to show the filled/unfilled bookmark icon.
 */
export async function isChapterBookmarked(
  userId: string,
  novelId: string,
  chapterIndex: number
): Promise<boolean> {
  const bookmark = await prisma.bookmark.findUnique({
    where: {
      userId_novelId_chapterIndex: { userId, novelId, chapterIndex },
    },
    select: { id: true },
  });

  return bookmark !== null;
}

/**
 * List all bookmarks for a novel, ordered by chapter index.
 * Returns a lightweight array for the bookmark sidebar / panel.
 */
export async function getBookmarksForNovel(
  userId: string,
  novelId: string
): Promise<BookmarkData[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId, novelId },
    orderBy: { chapterIndex: "asc" },
    select: {
      id: true,
      chapterIndex: true,
      note: true,
      createdAt: true,
    },
  });

  return bookmarks;
}

/**
 * Batch-loads bookmark counts for multiple novels in a single query.
 * Used by the dashboard to show bookmark badges without N+1.
 */
export async function getBookmarkCountsBatch(
  userId: string,
  novelIds: string[]
): Promise<Map<string, number>> {
  if (novelIds.length === 0) return new Map();

  const counts = await prisma.bookmark.groupBy({
    by: ["novelId"],
    where: { userId, novelId: { in: novelIds } },
    _count: { id: true },
  });

  const map = new Map<string, number>();
  for (const c of counts) {
    map.set(c.novelId, c._count.id);
  }

  return map;
}

/**
 * Returns the set of bookmarked chapter indices for a novel.
 * Used by the reader to highlight bookmarked chapters in the TOC drawer.
 */
export async function getBookmarkedChapterIndices(
  userId: string,
  novelId: string
): Promise<Set<number>> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId, novelId },
    select: { chapterIndex: true },
  });

  return new Set(bookmarks.map((b) => b.chapterIndex));
}
