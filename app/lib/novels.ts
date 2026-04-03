import { cache } from "react";
import { prisma } from "./prisma";
import type { Novel } from "../generated/prisma/client";
import { notFound } from "next/navigation";
import { deleteNovelFile } from "./storage";
import { unlink } from "fs/promises";

export type NovelCreateInput = {
  title: string;
  originalFileName: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  userId: string;
};

/** Inserts a new novel record into the database. */
export async function createNovel(data: NovelCreateInput): Promise<Novel> {
  return prisma.novel.create({ data });
}

/** Lists all novels owned by the given user, pinned first (by pinnedAt), then newest first. */
export async function listNovels(userId: string): Promise<Novel[]> {
  return prisma.novel.findMany({
    where: { userId },
    orderBy: [
      { isPinned: "desc" },
      { pinnedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
}

/** Fetches a single novel by primary key, or `null` if not found. */
export async function getNovelById(id: string): Promise<Novel | null> {
  return prisma.novel.findUnique({ where: { id } });
}

/**
 * React `cache()`-wrapped version of {@link getNovelById}.
 * De-duplicates the DB call within a single Server Component render cycle
 * (used by both `generateMetadata` and page data fetching).
 */
export const cachedGetNovelById = cache(getNovelById);

/** Updates the cached chapter count after parsing completes. */
export async function updateNovelChapterCount(
  id: string,
  chapterCount: number
): Promise<void> {
  await prisma.novel.update({
    where: { id },
    data: { chapterCount },
  });
}

/**
 * Fetches a novel by ID, throwing a Next.js `notFound()` if the record is
 * missing or doesn't belong to the given user. Useful for Server Component
 * pages where a 404 response is the correct fallback.
 */
export async function getNovelByIdOrNotFound(id: string, userId: string): Promise<Novel> {
  const novel = await cachedGetNovelById(id);

  if (!novel || novel.userId !== userId) {
    notFound();
  }

  return novel;
}

/**
 * Deletes a novel and all associated data.
 *
 * Cascade behaviour (handled by Prisma's onDelete: Cascade):
 *   Novel → NovelTranslation → NovelTranslationChapter
 *   Novel → NovelGlossaryEntry → NovelGlossaryVariant
 *   Novel → ReadingProgress → ChapterVisit
 *
 * File cleanup (best-effort, non-blocking):
 *   1. The uploaded novel file in storage/novels/
 *   2. Any translation export files in storage/translations/
 *
 * @returns The deleted Novel record
 */
export async function deleteNovel(novelId: string, userId: string): Promise<Novel> {
  // 1. Verify ownership — fetch novel + export paths in one round-trip
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: {
      translations: { select: { exportPath: true } },
    },
  });

  if (!novel || novel.userId !== userId) {
    throw new NovelNotFoundError(novelId);
  }

  // 2. Collect file paths to clean up after DB delete
  const exportPaths = novel.translations
    .map((t) => t.exportPath)
    .filter((p): p is string => p !== null);

  // 3. DB delete — cascades remove translations, chapters, glossary, progress, visits
  const deleted = await prisma.novel.delete({ where: { id: novelId } });

  // 4. Best-effort file cleanup (don't throw if files are already gone)
  const cleanupPromises: Promise<void>[] = [
    deleteNovelFile(novel.storagePath),
  ];

  for (const exportPath of exportPaths) {
    cleanupPromises.push(
      unlink(exportPath).catch((err: unknown) => {
        if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
          return; // already gone
        }
        console.error(`Failed to clean up export file: ${exportPath}`, err);
      })
    );
  }

  await Promise.allSettled(cleanupPromises);

  return deleted;
}

/**
 * Toggles the pinned state of a novel.
 * Sets `isPinned` to the opposite of its current value, and
 * records `pinnedAt` (used for stable ordering among pinned novels).
 *
 * @returns `{ isPinned: boolean }` — the new pin state
 * @throws {NovelNotFoundError} if the novel doesn't exist or doesn't belong to the user
 */
export async function toggleNovelPin(
  novelId: string,
  userId: string
): Promise<{ isPinned: boolean }> {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    select: { userId: true, isPinned: true },
  });

  if (!novel || novel.userId !== userId) {
    throw new NovelNotFoundError(novelId);
  }

  const newPinned = !novel.isPinned;

  await prisma.novel.update({
    where: { id: novelId },
    data: {
      isPinned: newPinned,
      pinnedAt: newPinned ? new Date() : null,
    },
  });

  return { isPinned: newPinned };
}

export class NovelNotFoundError extends Error {
  constructor(novelId: string) {
    super(`Novel not found: ${novelId}`);
    this.name = "NovelNotFoundError";
  }
}
