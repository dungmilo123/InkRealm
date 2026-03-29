import { TranslationStatus, type TranslationProvider } from "@/app/generated/prisma/client";
import { getNovelById } from "@/app/lib/novels";
import {
  ReaderUnavailableError,
  getReaderDocument,
} from "@/app/lib/reader";
import { getTranslationAdapter } from "@/app/lib/translation/adapters";
import type { GlossaryPromptEntry, ChapterContext } from "@/app/lib/translation/adapters";
import {
  countTranslatedChapters,
  createTranslationJobRecord,
  getTranslationJobById,
  getTranslationJobForRunner,
  listPendingChaptersForRun,
  listPreviousTranslatedChapters,
  listTranslatedChaptersForExport,
  listTranslationJobsForNovel,
  markChapterFailed,
  markChapterTranslated,
  markChapterTranslating,
  prepareTranslationRetry,
  setTranslationCompleted,
  setTranslationFailed,
  setTranslationInProgress,
  updateChapterSummary,
  updateTranslationCompletedCount,
  type TranslationJobSummary,
} from "@/app/lib/translation/data";
import { canDownloadTranslationExport, writeTranslatedExportFile } from "@/app/lib/translation/export";
import { TranslationHttpError, toErrorMessage } from "@/app/lib/translation/errors";
import {
  getCredentialForTranslationSnapshot,
  getTranslationProfileCredential,
} from "@/app/lib/translation/profiles";
import {
  calculateTranslationProgressPercent,
  canRetryTranslationStatus,
  canRunTranslationStatus,
} from "@/app/lib/translation/state";
import {
  listGlossaryEntriesForTranslation,
  createPendingGlossaryEntries,
} from "@/app/lib/translation/glossary";
import { resolveQualityPreset } from "@/app/lib/translation/quality-presets";
import { GlossaryEntryStatus } from "@/app/generated/prisma/client";

export const DEFAULT_TRANSLATION_BATCH_SIZE = 4;
export const MAX_TRANSLATION_BATCH_SIZE = 20;

export type TranslationJobView = TranslationJobSummary & {
  progressPercent: number;
  downloadUrl: string | null;
};

function clampBatchSize(batchSize: number) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    return DEFAULT_TRANSLATION_BATCH_SIZE;
  }

  return Math.min(batchSize, MAX_TRANSLATION_BATCH_SIZE);
}

function toTranslationJobView(job: TranslationJobSummary): TranslationJobView {
  const progressPercent = calculateTranslationProgressPercent(
    job.completedChapters,
    job.totalChapters
  );

  return {
    ...job,
    progressPercent,
    downloadUrl: canDownloadTranslationExport({
      status: job.status,
      exportPath: job.exportPath,
    })
      ? `/api/translation/jobs/${job.id}/export`
      : null,
  };
}

function getChapterSourceText(paragraphs: string[]) {
  return paragraphs.join("\n\n").trim();
}

function trimFailureReason(error: unknown) {
  return toErrorMessage(error).slice(0, 1000);
}

async function resolveRunnerCredential(input: {
  providerSnapshot: TranslationProvider;
  modelSnapshot: string;
  profileId?: string;
  userId: string;
}) {
  if (input.profileId) {
    const selected = await getTranslationProfileCredential(input.profileId, input.userId);
    if (
      selected.provider !== input.providerSnapshot ||
      selected.model !== input.modelSnapshot
    ) {
      throw new TranslationHttpError(
        400,
        "Selected profile does not match translation provider/model snapshot."
      );
    }

    return selected;
  }

  return getCredentialForTranslationSnapshot(
    input.providerSnapshot,
    input.modelSnapshot,
    input.userId
  );
}

async function finalizeTranslationState(input: {
  translationId: string;
  novelTitle: string;
}) {
  const translatedCount = await countTranslatedChapters(input.translationId);
  const updated = await updateTranslationCompletedCount(
    input.translationId,
    translatedCount
  );

  if (translatedCount >= updated.totalChapters && updated.totalChapters > 0) {
    const chapters = await listTranslatedChaptersForExport(input.translationId);
    if (chapters.length !== updated.totalChapters) {
      const failed = await setTranslationFailed({
        translationId: input.translationId,
        failedChapterIndex: translatedCount + 1,
        failureReason:
          "Translated chapter count mismatch while preparing export artifact.",
      });
      return toTranslationJobView(failed);
    }

    const exportFile = await writeTranslatedExportFile({
      translationId: input.translationId,
      novelTitle: input.novelTitle,
      targetLanguage: updated.targetLanguage,
      chapters,
    });

    const completed = await setTranslationCompleted({
      translationId: input.translationId,
      exportPath: exportFile.filePath,
      completedChapters: translatedCount,
    });
    return toTranslationJobView(completed);
  }

  if (updated.status !== TranslationStatus.FAILED) {
    const inProgress = await setTranslationInProgress(input.translationId);
    return toTranslationJobView(inProgress);
  }

  return toTranslationJobView(updated);
}

export async function listNovelTranslationJobViews(novelId: string, userId: string) {
  const novel = await getNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }
  const jobs = await listTranslationJobsForNovel(novelId);
  return jobs.map(toTranslationJobView);
}

export async function createTranslationJobFromNovelDetails(input: {
  novelId: string;
  targetLanguage: string;
  profileId: string;
  batchSize?: number;
  qualityPreset?: string;
  userId: string;
}) {
  const novel = await getNovelById(input.novelId);
  if (!novel || novel.userId !== input.userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }

  const profile = await getTranslationProfileCredential(input.profileId, input.userId);

  let readerDocument: Awaited<ReturnType<typeof getReaderDocument>>;
  try {
    readerDocument = await getReaderDocument(novel);
  } catch (error) {
    if (error instanceof ReaderUnavailableError) {
      throw new TranslationHttpError(400, error.message);
    }

    throw error;
  }

  if (readerDocument.chapterCount === 0) {
    throw new TranslationHttpError(
      400,
      "This novel has no readable chapters for translation."
    );
  }

  const quality = resolveQualityPreset(input.qualityPreset);

  const created = await createTranslationJobRecord({
    novelId: novel.id,
    targetLanguage: input.targetLanguage,
    providerSnapshot: profile.provider,
    modelSnapshot: profile.model,
    contextChapters: quality.contextChapters,
    contextSummaries: quality.contextSummaries,
    useGlossary: quality.useGlossary,
    chapters: readerDocument.chapters.map((chapter) => ({
      chapterIndex: chapter.index,
      originalTitle: chapter.title,
    })),
  });

  return runTranslationJobBatch({
    translationId: created.id,
    batchSize: input.batchSize,
    profileId: profile.profileId,
    allowFailedState: false,
    userId: input.userId,
  });
}

export async function runTranslationJobBatch(input: {
  translationId: string;
  batchSize?: number;
  profileId?: string;
  allowFailedState?: boolean;
  userId: string;
}) {
  const runnerState = await getTranslationJobForRunner(input.translationId);
  if (!runnerState) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  if (runnerState.novel.userId !== input.userId) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  if (runnerState.status === TranslationStatus.COMPLETED) {
    const completed = await getTranslationJobById(input.translationId);
    if (!completed) {
      throw new TranslationHttpError(404, "Translation job not found.");
    }

    return toTranslationJobView(completed);
  }

  if (
    !canRunTranslationStatus(runnerState.status) &&
    !(runnerState.status === TranslationStatus.FAILED && input.allowFailedState)
  ) {
    throw new TranslationHttpError(
      409,
      "Translation job is not in a runnable state."
    );
  }

  if (
    runnerState.status === TranslationStatus.FAILED &&
    !input.allowFailedState
  ) {
    throw new TranslationHttpError(
      409,
      "Translation job is failed. Retry before running it again."
    );
  }

  const credential = await resolveRunnerCredential({
    providerSnapshot: runnerState.providerSnapshot,
    modelSnapshot: runnerState.modelSnapshot,
    profileId: input.profileId,
    userId: input.userId,
  });

  let readerDocument: Awaited<ReturnType<typeof getReaderDocument>>;
  try {
    readerDocument = await getReaderDocument(runnerState.novel);
  } catch (error) {
    if (error instanceof ReaderUnavailableError) {
      const failed = await setTranslationFailed({
        translationId: input.translationId,
        failedChapterIndex: 1,
        failureReason: error.message,
      });
      return toTranslationJobView(failed);
    }

    throw error;
  }

  await setTranslationInProgress(input.translationId);

  const hasContext = runnerState.contextChapters > 0 || runnerState.contextSummaries > 0;

  // When context is needed, process sequentially (1 at a time)
  // Otherwise use the requested batch size
  const effectiveBatchSize = hasContext
    ? 1
    : clampBatchSize(input.batchSize ?? DEFAULT_TRANSLATION_BATCH_SIZE);

  const pending = await listPendingChaptersForRun(input.translationId, effectiveBatchSize);

  if (pending.length === 0) {
    return finalizeTranslationState({
      translationId: input.translationId,
      novelTitle: runnerState.novel.title,
    });
  }

  // Load glossary once if needed
  let glossary: GlossaryPromptEntry[] | undefined;
  if (runnerState.useGlossary) {
    const entries = await listGlossaryEntriesForTranslation(runnerState.novelId);
    glossary = entries.map((e) => ({
      canonical: e.canonical,
      type: e.type.toLowerCase(),
      status: e.status === GlossaryEntryStatus.CONFIRMED ? "confirmed" as const : "pending" as const,
      variants: e.variants.map((v) => v.variant),
    }));
  }

  const adapter = getTranslationAdapter(runnerState.providerSnapshot);
  for (const chapterState of pending) {
    const claimed = await markChapterTranslating(
      input.translationId,
      chapterState.chapterIndex
    );
    if (!claimed) {
      continue;
    }

    const sourceChapter = readerDocument.chapters[chapterState.chapterIndex - 1];
    if (!sourceChapter) {
      const message = `Source chapter ${chapterState.chapterIndex} is missing.`;
      await markChapterFailed({
        translationId: input.translationId,
        chapterIndex: chapterState.chapterIndex,
        errorMessage: message,
      });

      const failed = await setTranslationFailed({
        translationId: input.translationId,
        failedChapterIndex: chapterState.chapterIndex,
        failureReason: message,
      });
      return toTranslationJobView(failed);
    }

    // Assemble context from previous chapters
    let previousContext: ChapterContext[] | undefined;
    if (hasContext && chapterState.chapterIndex > 1) {
      const maxContextNeeded = Math.max(
        runnerState.contextChapters,
        runnerState.contextSummaries
      );
      const prevChapters = await listPreviousTranslatedChapters(
        input.translationId,
        chapterState.chapterIndex,
        maxContextNeeded
      );

      // prevChapters is ordered desc by chapterIndex — reverse to chronological
      const sorted = prevChapters.reverse();

      previousContext = sorted.map((ch, idx) => {
        const isFullContext = idx >= sorted.length - runnerState.contextChapters;
        return {
          chapterIndex: ch.chapterIndex,
          translatedContent: isFullContext ? (ch.translatedContent ?? "") : "",
          summary: idx < runnerState.contextSummaries ? ch.summary : null,
        };
      }).filter((c) => c.translatedContent || c.summary);
    }

    try {
      const translated = await adapter.translateChapter(
        {
          provider: runnerState.providerSnapshot,
          model: runnerState.modelSnapshot,
          apiKey: credential.apiKey,
          baseUrl: credential.baseUrl,
        },
        {
          targetLanguage: runnerState.targetLanguage,
          sourceTitle: sourceChapter.title,
          sourceContent: getChapterSourceText(sourceChapter.paragraphs),
          glossary,
          previousContext,
        }
      );

      await markChapterTranslated({
        translationId: input.translationId,
        chapterIndex: chapterState.chapterIndex,
        translatedTitle: translated.translatedTitle,
        translatedContent: translated.translatedContent,
      });

      // Persist chapter summary if returned
      if (translated.chapterSummary) {
        await updateChapterSummary(
          input.translationId,
          chapterState.chapterIndex,
          translated.chapterSummary
        );
      }

      // Persist detected terms as pending glossary entries
      if (translated.detectedTerms && translated.detectedTerms.length > 0 && runnerState.useGlossary) {
        const newEntries = await createPendingGlossaryEntries({
          novelId: runnerState.novelId,
          terms: translated.detectedTerms,
        });

        // Add newly created entries to the in-memory glossary for subsequent chapters
        if (glossary && newEntries.length > 0) {
          for (const entry of newEntries) {
            glossary.push({
              canonical: entry.canonical,
              type: entry.type.toLowerCase(),
              status: "pending",
              variants: entry.variants.map((v) => v.variant),
            });
          }
        }
      }
    } catch (error) {
      const reason = trimFailureReason(error);
      await markChapterFailed({
        translationId: input.translationId,
        chapterIndex: chapterState.chapterIndex,
        errorMessage: reason,
      });

      const failed = await setTranslationFailed({
        translationId: input.translationId,
        failedChapterIndex: chapterState.chapterIndex,
        failureReason: reason,
      });
      return toTranslationJobView(failed);
    }
  }

  return finalizeTranslationState({
    translationId: input.translationId,
    novelTitle: runnerState.novel.title,
  });
}

export async function retryTranslationJob(input: {
  translationId: string;
  batchSize?: number;
  profileId?: string;
  userId: string;
}) {
  const job = await getTranslationJobById(input.translationId);
  if (!job) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  const novel = await getNovelById(job.novelId);
  if (!novel || novel.userId !== input.userId) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  if (!canRetryTranslationStatus(job.status)) {
    throw new TranslationHttpError(409, "Only failed translation jobs can retry.");
  }

  await prepareTranslationRetry(input.translationId);

  return runTranslationJobBatch({
    translationId: input.translationId,
    batchSize: input.batchSize,
    profileId: input.profileId,
    allowFailedState: true,
    userId: input.userId,
  });
}

export async function getTranslationJobStatus(translationId: string, userId: string) {
  const job = await getTranslationJobById(translationId);
  if (!job) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  const novel = await getNovelById(job.novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  return toTranslationJobView(job);
}

export async function getDownloadableTranslationJob(translationId: string, userId: string) {
  const job = await getTranslationJobById(translationId);
  if (!job) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  // Verify ownership through novel
  const novel = await getNovelById(job.novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  if (
    !canDownloadTranslationExport({
      status: job.status,
      exportPath: job.exportPath,
    })
  ) {
    throw new TranslationHttpError(404, "Translation export is not available.");
  }

  return job;
}
