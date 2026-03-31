import {
  ChapterTranslationStatus,
  TranslationStatus,
  type TranslationProvider,
} from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";

const profilePublicSelect = {
  id: true,
  provider: true,
  model: true,
  baseUrl: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

const profileWithSecretSelect = {
  ...profilePublicSelect,
  encryptedApiKey: true,
  userId: true,
} as const;

const translationJobSummarySelect = {
  id: true,
  novelId: true,
  targetLanguage: true,
  providerSnapshot: true,
  modelSnapshot: true,
  status: true,
  totalChapters: true,
  completedChapters: true,
  failedChapterIndex: true,
  failureReason: true,
  exportPath: true,
  contextChapters: true,
  contextSummaries: true,
  useGlossary: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TranslationProfilePublic = Awaited<
  ReturnType<typeof listTranslationProfiles>
>[number];

export type TranslationProfileWithSecret = NonNullable<
  Awaited<ReturnType<typeof getTranslationProfileByIdWithSecret>>
>;

export type TranslationJobSummary = Awaited<
  ReturnType<typeof listTranslationJobsForNovel>
>[number];

export type TranslationChapterForExport = Awaited<
  ReturnType<typeof listTranslatedChaptersForExport>
>[number];

export async function listTranslationProfiles(userId: string) {
  return prisma.translationProfile.findMany({
    where: { userId },
    select: profilePublicSelect,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createTranslationProfileRecord(input: {
  provider: TranslationProvider;
  model: string;
  baseUrl: string | null;
  encryptedApiKey: string;
  isDefault: boolean;
  userId: string;
}) {
  return prisma.translationProfile.create({
    data: input,
    select: profilePublicSelect,
  });
}

export async function getTranslationProfileByIdWithSecret(profileId: string) {
  return prisma.translationProfile.findUnique({
    where: { id: profileId },
    select: profileWithSecretSelect,
  });
}

export async function updateTranslationProfileRecord(
  profileId: string,
  input: {
    provider?: TranslationProvider;
    model?: string;
    baseUrl?: string | null;
    encryptedApiKey?: string;
  }
) {
  return prisma.translationProfile.update({
    where: { id: profileId },
    data: input,
    select: profilePublicSelect,
  });
}

export async function getDefaultTranslationProfile(userId: string) {
  return prisma.translationProfile.findFirst({
    where: { userId, isDefault: true },
    select: profilePublicSelect,
  });
}

export async function setDefaultTranslationProfileRecord(profileId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.translationProfile.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    return tx.translationProfile.update({
      where: { id: profileId },
      data: { isDefault: true },
      select: profilePublicSelect,
    });
  });
}

export async function deleteTranslationProfileRecord(profileId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.translationProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true, isDefault: true },
    });

    if (!profile || profile.userId !== userId) {
      return null;
    }

    await tx.translationProfile.delete({ where: { id: profileId } });

    if (profile.isDefault) {
      const nextDefault = await tx.translationProfile.findFirst({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }],
        select: { id: true },
      });

      if (nextDefault) {
        await tx.translationProfile.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    return profile;
  });
}

export async function findLatestProfileForSnapshot(
  provider: TranslationProvider,
  model: string,
  userId: string
) {
  return prisma.translationProfile.findFirst({
    where: {
      provider,
      model,
      userId,
    },
    select: profileWithSecretSelect,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createTranslationJobRecord(input: {
  novelId: string;
  targetLanguage: string;
  providerSnapshot: TranslationProvider;
  modelSnapshot: string;
  contextChapters?: number;
  contextSummaries?: number;
  useGlossary?: boolean;
  chapters: Array<{
    chapterIndex: number;
    originalTitle: string;
  }>;
}) {
  return prisma.novelTranslation.create({
    data: {
      novelId: input.novelId,
      targetLanguage: input.targetLanguage,
      providerSnapshot: input.providerSnapshot,
      modelSnapshot: input.modelSnapshot,
      status: TranslationStatus.PENDING,
      totalChapters: input.chapters.length,
      completedChapters: 0,
      contextChapters: input.contextChapters ?? 0,
      contextSummaries: input.contextSummaries ?? 0,
      useGlossary: input.useGlossary ?? false,
      chapters: {
        create: input.chapters.map((chapter) => ({
          chapterIndex: chapter.chapterIndex,
          originalTitle: chapter.originalTitle,
          status: ChapterTranslationStatus.PENDING,
        })),
      },
    },
    select: translationJobSummarySelect,
  });
}

export async function listTranslationJobsForNovel(novelId: string) {
  return prisma.novelTranslation.findMany({
    where: { novelId },
    orderBy: [{ createdAt: "desc" }],
    select: translationJobSummarySelect,
  });
}

export async function getTranslationJobById(translationId: string) {
  return prisma.novelTranslation.findUnique({
    where: { id: translationId },
    select: translationJobSummarySelect,
  });
}

export async function getTranslationJobForRunner(translationId: string) {
  return prisma.novelTranslation.findUnique({
    where: { id: translationId },
    include: {
      novel: true,
      chapters: {
        orderBy: { chapterIndex: "asc" },
      },
    },
  });
}

export async function listPendingChaptersForRun(
  translationId: string,
  limit: number
) {
  return prisma.novelTranslationChapter.findMany({
    where: {
      translationId,
      status: ChapterTranslationStatus.PENDING,
    },
    orderBy: {
      chapterIndex: "asc",
    },
    take: limit,
  });
}

export async function markChapterTranslating(
  translationId: string,
  chapterIndex: number
) {
  const updated = await prisma.novelTranslationChapter.updateMany({
    where: {
      translationId,
      chapterIndex,
      status: ChapterTranslationStatus.PENDING,
    },
    data: {
      status: ChapterTranslationStatus.TRANSLATING,
    },
  });

  return updated.count > 0;
}

export async function markChapterTranslated(input: {
  translationId: string;
  chapterIndex: number;
  translatedTitle: string;
  translatedContent: string;
}) {
  return prisma.novelTranslationChapter.update({
    where: {
      translationId_chapterIndex: {
        translationId: input.translationId,
        chapterIndex: input.chapterIndex,
      },
    },
    data: {
      status: ChapterTranslationStatus.TRANSLATED,
      translatedTitle: input.translatedTitle,
      translatedContent: input.translatedContent,
      errorMessage: null,
    },
  });
}

export async function markChapterFailed(input: {
  translationId: string;
  chapterIndex: number;
  errorMessage: string;
}) {
  return prisma.novelTranslationChapter.update({
    where: {
      translationId_chapterIndex: {
        translationId: input.translationId,
        chapterIndex: input.chapterIndex,
      },
    },
    data: {
      status: ChapterTranslationStatus.FAILED,
      errorMessage: input.errorMessage,
    },
  });
}

export async function countTranslatedChapters(translationId: string) {
  return prisma.novelTranslationChapter.count({
    where: {
      translationId,
      status: ChapterTranslationStatus.TRANSLATED,
    },
  });
}

export async function updateTranslationCompletedCount(
  translationId: string,
  completedChapters: number
) {
  return prisma.novelTranslation.update({
    where: { id: translationId },
    data: {
      completedChapters,
    },
    select: translationJobSummarySelect,
  });
}

export async function setTranslationInProgress(translationId: string) {
  return prisma.novelTranslation.update({
    where: { id: translationId },
    data: {
      status: TranslationStatus.IN_PROGRESS,
      failureReason: null,
      failedChapterIndex: null,
    },
    select: translationJobSummarySelect,
  });
}

export async function setTranslationFailed(input: {
  translationId: string;
  failedChapterIndex: number;
  failureReason: string;
}) {
  return prisma.novelTranslation.update({
    where: { id: input.translationId },
    data: {
      status: TranslationStatus.FAILED,
      failedChapterIndex: input.failedChapterIndex,
      failureReason: input.failureReason,
    },
    select: translationJobSummarySelect,
  });
}

export async function setTranslationCompleted(input: {
  translationId: string;
  exportPath: string;
  completedChapters: number;
}) {
  return prisma.novelTranslation.update({
    where: { id: input.translationId },
    data: {
      status: TranslationStatus.COMPLETED,
      failedChapterIndex: null,
      failureReason: null,
      completedChapters: input.completedChapters,
      exportPath: input.exportPath,
    },
    select: translationJobSummarySelect,
  });
}

export async function setTranslationCancelled(translationId: string) {
  return prisma.novelTranslation.update({
    where: { id: translationId },
    data: {
      status: TranslationStatus.CANCELLED,
    },
    select: translationJobSummarySelect,
  });
}

export async function getLatestTranslationJobForNovel(novelId: string) {
  return prisma.novelTranslation.findFirst({
    where: { novelId },
    orderBy: { createdAt: "desc" },
    select: translationJobSummarySelect,
  });
}

export async function countChapterTranslationStats(novelId: string) {
  const latest = await prisma.novelTranslation.findFirst({
    where: { novelId, status: TranslationStatus.COMPLETED },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return { translated: 0 };
  const translated = await prisma.novelTranslationChapter.count({
    where: { translationId: latest.id, status: ChapterTranslationStatus.TRANSLATED },
  });
  return { translated };
}

export async function prepareTranslationRetry(translationId: string) {
  await prisma.$transaction([
    prisma.novelTranslation.update({
      where: { id: translationId },
      data: {
        status: TranslationStatus.PENDING,
        failedChapterIndex: null,
        failureReason: null,
      },
    }),
    prisma.novelTranslationChapter.updateMany({
      where: {
        translationId,
        status: {
          in: [
            ChapterTranslationStatus.FAILED,
            ChapterTranslationStatus.TRANSLATING,
          ],
        },
      },
      data: {
        status: ChapterTranslationStatus.PENDING,
        errorMessage: null,
        translatedTitle: null,
        translatedContent: null,
      },
    }),
  ]);
}

export async function listTranslatedChaptersForExport(translationId: string) {
  return prisma.novelTranslationChapter.findMany({
    where: {
      translationId,
      status: ChapterTranslationStatus.TRANSLATED,
    },
    orderBy: {
      chapterIndex: "asc",
    },
    select: {
      chapterIndex: true,
      translatedTitle: true,
      translatedContent: true,
    },
  });
}

export async function listPreviousTranslatedChapters(
  translationId: string,
  beforeChapterIndex: number,
  limit: number
) {
  return prisma.novelTranslationChapter.findMany({
    where: {
      translationId,
      chapterIndex: { lt: beforeChapterIndex },
      status: ChapterTranslationStatus.TRANSLATED,
    },
    orderBy: { chapterIndex: "desc" },
    take: limit,
    select: {
      chapterIndex: true,
      translatedContent: true,
      summary: true,
    },
  });
}

export async function updateChapterSummary(
  translationId: string,
  chapterIndex: number,
  summary: string
) {
  return prisma.novelTranslationChapter.update({
    where: {
      translationId_chapterIndex: {
        translationId,
        chapterIndex,
      },
    },
    data: { summary },
  });
}
