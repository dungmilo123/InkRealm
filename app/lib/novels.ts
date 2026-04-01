import { cache } from "react";
import { prisma } from "./prisma";
import type { Novel } from "../generated/prisma/client";
import { notFound } from "next/navigation";

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
