import { prisma } from "./prisma";
import type { Novel, TranslationProfile, NovelTranslation, NovelTranslationChapter, ChapterTranslationStatus, TranslationStatus } from "../generated/prisma/client";
import type { ReaderChapter } from "./reader/types";

export type { TranslationProfile, NovelTranslation, NovelTranslationChapter, ChapterTranslationStatus, TranslationStatus };

export async function createTranslationProfile(data: {
  userId: string;
  provider: TranslationProfile["provider"];
  model: string;
  baseUrl?: string | null;
  encryptedApiKey: string;
}): Promise<TranslationProfile> {
  return prisma.translationProfile.create({
    data: {
      userId: data.userId,
      provider: data.provider,
      model: data.model,
      baseUrl: data.baseUrl,
      encryptedApiKey: data.encryptedApiKey,
    },
  });
}

export async function getTranslationProfile(): Promise<TranslationProfile | null> {
  const profiles = await prisma.translationProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  return profiles[0] ?? null;
}

export async function updateTranslationProfile(
  id: string,
  data: {
    provider?: TranslationProfile["provider"];
    model?: string;
    baseUrl?: string | null;
    encryptedApiKey?: string;
  }
): Promise<TranslationProfile> {
  return prisma.translationProfile.update({
    where: { id },
    data,
  });
}

export async function createNovelTranslation(data: {
  novelId: string;
  targetLanguage: string;
  providerSnapshot: NovelTranslation["providerSnapshot"];
  modelSnapshot: string;
  totalChapters: number;
}): Promise<NovelTranslation> {
  return prisma.novelTranslation.create({
    data: {
      novelId: data.novelId,
      targetLanguage: data.targetLanguage,
      providerSnapshot: data.providerSnapshot,
      modelSnapshot: data.modelSnapshot,
      totalChapters: data.totalChapters,
      status: "PENDING",
    },
  });
}

export async function getNovelTranslation(novelId: string): Promise<NovelTranslation | null> {
  return prisma.novelTranslation.findFirst({
    where: { novelId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getNovelTranslationWithChapters(novelId: string): Promise<NovelTranslation & { chapters: NovelTranslationChapter[] } | null> {
  return prisma.novelTranslation.findFirst({
    where: { novelId },
    orderBy: { createdAt: "desc" },
    include: { chapters: { orderBy: { chapterIndex: "asc" } } },
  });
}

export async function getTranslationById(id: string): Promise<NovelTranslation | null> {
  return prisma.novelTranslation.findUnique({
    where: { id },
  });
}

export async function getTranslationWithChapters(id: string): Promise<(NovelTranslation & { chapters: NovelTranslationChapter[] }) | null> {
  return prisma.novelTranslation.findUnique({
    where: { id },
    include: { chapters: { orderBy: { chapterIndex: "asc" } } },
  });
}

export async function updateTranslationStatus(
  id: string,
  status: TranslationStatus,
  additionalData?: {
    completedChapters?: number;
    failedChapterIndex?: number | null;
    failureReason?: string | null;
    exportPath?: string | null;
  }
): Promise<NovelTranslation> {
  return prisma.novelTranslation.update({
    where: { id },
    data: {
      status,
      ...additionalData,
    },
  });
}

export async function createTranslationChapter(data: {
  translationId: string;
  chapterIndex: number;
  originalTitle: string;
}): Promise<NovelTranslationChapter> {
  return prisma.novelTranslationChapter.create({
    data: {
      translationId: data.translationId,
      chapterIndex: data.chapterIndex,
      originalTitle: data.originalTitle,
      status: "PENDING",
    },
  });
}

export async function getTranslationChapter(
  translationId: string,
  chapterIndex: number
): Promise<NovelTranslationChapter | null> {
  return prisma.novelTranslationChapter.findUnique({
    where: {
      translationId_chapterIndex: {
        translationId,
        chapterIndex,
      },
    },
  });
}

export async function getNextPendingChapter(translationId: string): Promise<NovelTranslationChapter | null> {
  return prisma.novelTranslationChapter.findFirst({
    where: {
      translationId,
      status: "PENDING",
    },
    orderBy: { chapterIndex: "asc" },
  });
}

export async function updateChapterTranslation(
  translationId: string,
  chapterIndex: number,
  data: {
    status: ChapterTranslationStatus;
    translatedTitle?: string;
    translatedContent?: string;
    errorMessage?: string;
  }
): Promise<NovelTranslationChapter> {
  return prisma.novelTranslationChapter.update({
    where: {
      translationId_chapterIndex: {
        translationId,
        chapterIndex,
      },
    },
    data,
  });
}

export async function getTranslatedChapter(
  novelId: string,
  chapterIndex: number
): Promise<NovelTranslationChapter | null> {
  const translation = await getNovelTranslation(novelId);
  if (!translation) return null;
  
  return prisma.novelTranslationChapter.findUnique({
    where: {
      translationId_chapterIndex: {
        translationId: translation.id,
        chapterIndex,
      },
    },
  });
}

export async function getTranslatedChapterWithReaderChapter(
  novelId: string,
  chapterIndex: number
): Promise<{ translatedChapter: NovelTranslationChapter; readerChapter: ReaderChapter } | null> {
  const translation = await getNovelTranslation(novelId);
  if (!translation || translation.status !== "COMPLETED") return null;

  const translatedChapter = await prisma.novelTranslationChapter.findUnique({
    where: {
      translationId_chapterIndex: {
        translationId: translation.id,
        chapterIndex,
      },
    },
  });

  if (!translatedChapter || translatedChapter.status !== "TRANSLATED") return null;

  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) return null;

  const { getReaderChapter } = await import("./reader/service");
  try {
    const { chapter: readerChapter } = await getReaderChapter(novel, chapterIndex);
    return { translatedChapter, readerChapter };
  } catch {
    return null;
  }
}

export async function listNovelsWithTranslationStatus(): Promise<Array<Novel & { translation: NovelTranslation | null }>> {
  const novels = await prisma.novel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      translations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  
  return novels.map(novel => ({
    ...novel,
    translation: novel.translations[0] ?? null,
  }));
}

export async function getNovelWithTranslation(novelId: string): Promise<(Novel & { translation: NovelTranslation | null }) | null> {
  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) return null;
  
  const translation = await getNovelTranslation(novelId);
  return { ...novel, translation };
}

export async function ensureTranslationChapters(
  translationId: string,
  chapters: ReaderChapter[]
): Promise<void> {
  for (const chapter of chapters) {
    await prisma.novelTranslationChapter.upsert({
      where: {
        translationId_chapterIndex: {
          translationId,
          chapterIndex: chapter.index,
        },
      },
      update: {},
      create: {
        translationId,
        chapterIndex: chapter.index,
        originalTitle: chapter.title,
        status: "PENDING",
      },
    });
  }
}