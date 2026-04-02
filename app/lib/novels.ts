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

export async function createNovel(data: NovelCreateInput): Promise<Novel> {
  return prisma.novel.create({ data });
}

export async function listNovels(userId: string): Promise<Novel[]> {
  return prisma.novel.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getNovelById(id: string): Promise<Novel | null> {
  return prisma.novel.findUnique({ where: { id } });
}

export const cachedGetNovelById = cache(getNovelById);

export async function updateNovelChapterCount(
  id: string,
  chapterCount: number
): Promise<void> {
  await prisma.novel.update({
    where: { id },
    data: { chapterCount },
  });
}

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

export class NovelNotFoundError extends Error {
  constructor(novelId: string) {
    super(`Novel not found: ${novelId}`);
    this.name = "NovelNotFoundError";
  }
}
