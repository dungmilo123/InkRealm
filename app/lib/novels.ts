import { prisma } from "./prisma";
import type { Novel } from "../generated/prisma/client";

export type NovelCreateInput = {
  title: string;
  originalFileName: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

export async function createNovel(data: NovelCreateInput): Promise<Novel> {
  return prisma.novel.create({ data });
}

export async function listNovels(): Promise<Novel[]> {
  return prisma.novel.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getNovelById(id: string): Promise<Novel | null> {
  return prisma.novel.findUnique({ where: { id } });
}