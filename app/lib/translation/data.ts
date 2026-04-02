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
  customPrompt: true,
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

/** Lists all translation profiles for a user (public fields only, no API key). Ordered by default-first, then most recently updated. */
export async function listTranslationProfiles(userId: string) {
  return prisma.translationProfile.findMany({
    where: { userId },
    select: profilePublicSelect,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

/** Inserts a new translation profile. The API key must already be encrypted. */
export async function createTranslationProfileRecord(input: {
  provider: TranslationProvider;
  model: string;
  baseUrl: string | null;
  customPrompt: string | null;
  encryptedApiKey: string;
  isDefault: boolean;
  userId: string;
}) {
  return prisma.translationProfile.create({
    data: input,
    select: profilePublicSelect,
  });
}

/** Fetches a profile including the encrypted API key (for decryption in the service layer). */
export async function getTranslationProfileByIdWithSecret(profileId: string) {
  return prisma.translationProfile.findUnique({
    where: { id: profileId },
    select: profileWithSecretSelect,
  });
}

/** Partially updates a translation profile's provider, model, base URL, custom prompt, or encrypted API key. */
export async function updateTranslationProfileRecord(
  profileId: string,
  input: {
    provider?: TranslationProvider;
    model?: string;
    baseUrl?: string | null;
    customPrompt?: string | null;
    encryptedApiKey?: string;
  }
) {
  return prisma.translationProfile.update({
    where: { id: profileId },
    data: input,
    select: profilePublicSelect,
  });
}

/** Returns the user's default translation profile, or `null` if none is marked default. */
export async function getDefaultTranslationProfile(userId: string) {
  return prisma.translationProfile.findFirst({
    where: { userId, isDefault: true },
    select: profilePublicSelect,
  });
}

/**
 * Marks a profile as the default, clearing the flag on any previously default
 * profile for the same user (transactional).
 */
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

/**
 * Deletes a translation profile after verifying ownership.
 * If the deleted profile was the default, automatically promotes the
 * most recently updated remaining profile to default (transactional).
 * Returns `null` if the profile doesn't exist or isn't owned by the user.
 */
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

/**
 * Finds the most recently updated profile matching a specific provider+model
 * combination. Used to resolve credentials when re-running a translation job
 * whose original profile may have been deleted.
 */
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

/**
 * Creates a translation job record with its chapter rows in a single insert.
 * Chapters are initialized as PENDING with `completedChapters = 0`.
 */
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

/** Lists all translation jobs for a novel, newest first (summary fields only). */
export async function listTranslationJobsForNovel(novelId: string) {
  return prisma.novelTranslation.findMany({
    where: { novelId },
    orderBy: [{ createdAt: "desc" }],
    select: translationJobSummarySelect,
  });
}

/** Fetches a single translation job by ID (summary fields only). */
export async function getTranslationJobById(translationId: string) {
  return prisma.novelTranslation.findUnique({
    where: { id: translationId },
    select: translationJobSummarySelect,
  });
}

const translationJobRunnerSelect = {
  id: true,
  status: true,
  novelId: true,
  providerSnapshot: true,
  modelSnapshot: true,
  targetLanguage: true,
  contextChapters: true,
  contextSummaries: true,
  useGlossary: true,
  totalChapters: true,
  novel: {
    select: {
      id: true,
      userId: true,
      title: true,
      fileType: true,
      storagePath: true,
      updatedAt: true,
      chapterCount: true,
    },
  },
} as const;

/** Fetches a translation job with its novel data, used by the translation runner loop. */
export async function getTranslationJobForRunner(translationId: string) {
  return prisma.novelTranslation.findUnique({
    where: { id: translationId },
    select: translationJobRunnerSelect,
  });
}

/** Returns the next `limit` PENDING chapters for a translation job, ordered by chapter index. */
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

/**
 * Atomically claims a chapter for translation by transitioning PENDING → TRANSLATING.
 * Uses `updateMany` with a status filter as an optimistic lock — returns `false` if
 * the chapter was already claimed by another process.
 */
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

/** Persists a successfully translated chapter's title and content, clearing any prior error. */
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

/** Records a chapter translation failure with an error message. */
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

/** Counts how many chapters in a translation job have status TRANSLATED. */
export async function countTranslatedChapters(translationId: string) {
  return prisma.novelTranslationChapter.count({
    where: {
      translationId,
      status: ChapterTranslationStatus.TRANSLATED,
    },
  });
}

/** Syncs the `completedChapters` counter on the translation job record. */
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

/** Transitions a translation job to IN_PROGRESS, clearing any prior failure metadata. */
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

/** Records a translation job failure with the failing chapter index and reason. */
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

/** Marks a translation job as COMPLETED with its export path and final chapter count. */
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

/** Marks a translation job as user-cancelled. */
export async function setTranslationCancelled(translationId: string) {
  return prisma.novelTranslation.update({
    where: { id: translationId },
    data: {
      status: TranslationStatus.CANCELLED,
    },
    select: translationJobSummarySelect,
  });
}

/** Returns the most recent translation job for a novel, or `null` if none exist. */
export async function getLatestTranslationJobForNovel(novelId: string) {
  return prisma.novelTranslation.findFirst({
    where: { novelId },
    orderBy: { createdAt: "desc" },
    select: translationJobSummarySelect,
  });
}

/**
 * Counts how many chapters are translated in the novel's latest COMPLETED job.
 * Used by the "smart default" logic in job creation to skip already-translated chapters.
 */
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

/**
 * Resets a failed translation job for retry: sets the job back to PENDING,
 * clears failure metadata, and resets all FAILED/TRANSLATING chapters to PENDING
 * (transactional). Previously translated chapters are left intact.
 */
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

/** Lists all translated chapters for a job, ordered by chapter index. Used for export file generation. */
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

/**
 * Fetches up to `limit` previously translated chapters before a given chapter index,
 * ordered descending (most recent first). Used to build translation context
 * (summaries and/or full content) for the AI adapter.
 */
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

/** Persists an AI-generated summary for a translated chapter (used for context in later chapters). */
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

/** Returns per-chapter translation statuses for a job, ordered by chapter index. */
export async function getChapterTranslationStatuses(translationId: string) {
  return prisma.novelTranslationChapter.findMany({
    where: { translationId },
    orderBy: { chapterIndex: "asc" },
    select: {
      chapterIndex: true,
      status: true,
    },
  });
}

/** Fetches a single chapter's translated content (title + body) by translation job and chapter index. */
export async function getTranslatedChapterContent(translationId: string, chapterIndex: number) {
  return prisma.novelTranslationChapter.findUnique({
    where: {
      translationId_chapterIndex: {
        translationId,
        chapterIndex,
      },
    },
    select: {
      status: true,
      translatedTitle: true,
      translatedContent: true,
    },
  });
}

/**
 * Fetches a translation job with ownership verification and chapter statuses
 * in a single query. Uses the novel relation to filter by userId.
 * Returns null if job doesn't exist or ownership fails.
 */
export async function getTranslationJobWithOwnershipAndStatuses(
  translationId: string,
  userId: string
) {
  return prisma.novelTranslation.findFirst({
    where: {
      id: translationId,
      novel: { userId },
    },
    select: {
      ...translationJobSummarySelect,
      chapters: {
        select: {
          chapterIndex: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { chapterIndex: "asc" },
      },
    },
  });
}
