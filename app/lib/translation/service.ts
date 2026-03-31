import { TranslationStatus, type TranslationProvider } from "@/app/generated/prisma/client";
import { getNovelById } from "@/app/lib/novels";
import {
  ReaderUnavailableError,
  getReaderDocument,
} from "@/app/lib/reader";
import { getTranslationAdapter } from "@/app/lib/translation/adapters";
import type { GlossaryPromptEntry, ChapterContext } from "@/app/lib/translation/adapters";
import {
  countChapterTranslationStats,
  countTranslatedChapters,
  createTranslationJobRecord,
  getLatestTranslationJobForNovel,
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
  setTranslationCancelled,
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
  canCancelTranslationStatus,
  canRetryTranslationStatus,
  canRunTranslationStatus,
} from "@/app/lib/translation/state";
import {
  listGlossaryEntriesForTranslation,
  createPendingGlossaryEntries,
} from "@/app/lib/translation/glossary";
import { resolveQualityPreset } from "@/app/lib/translation/quality-presets";
import { GlossaryEntryStatus } from "@/app/generated/prisma/client";

export type TranslationJobView = TranslationJobSummary & {
  progressPercent: number;
  downloadUrl: string | null;
};

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
  profileId: string;
  userId: string;
  chapterFrom?: number;
  chapterTo?: number;
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

  const quality = resolveQualityPreset("premium");

  // Determine which chapters to translate
  let chaptersToTranslate = readerDocument.chapters;

  if (input.chapterFrom !== undefined || input.chapterTo !== undefined) {
    // Explicit range provided — validate and filter
    const from = input.chapterFrom ?? 1;
    const to = input.chapterTo ?? readerDocument.chapterCount;

    if (from < 1 || from > readerDocument.chapterCount) {
      throw new TranslationHttpError(400, `chapterFrom must be between 1 and ${readerDocument.chapterCount}.`);
    }
    if (to < from || to > readerDocument.chapterCount) {
      throw new TranslationHttpError(400, `chapterTo must be between ${from} and ${readerDocument.chapterCount}.`);
    }

    chaptersToTranslate = readerDocument.chapters.filter(
      (ch) => ch.index >= from && ch.index <= to
    );
  } else {
    // Smart default: skip already-translated chapters from prior completed jobs
    const stats = await countChapterTranslationStats(novel.id);
    if (stats.translated > 0 && stats.translated < readerDocument.chapterCount) {
      chaptersToTranslate = readerDocument.chapters.filter(
        (ch) => ch.index > stats.translated
      );
    }
  }

  if (chaptersToTranslate.length === 0) {
    throw new TranslationHttpError(
      400,
      "No chapters to translate. All chapters may already be translated."
    );
  }

  const created = await createTranslationJobRecord({
    novelId: novel.id,
    targetLanguage: "Vietnamese",
    providerSnapshot: profile.provider,
    modelSnapshot: profile.model,
    contextChapters: quality.contextChapters,
    contextSummaries: quality.contextSummaries,
    useGlossary: quality.useGlossary,
    chapters: chaptersToTranslate.map((chapter) => ({
      chapterIndex: chapter.index,
      originalTitle: chapter.title,
    })),
  });

  return toTranslationJobView(created);
}

export async function runTranslationJobBatch(input: {
  translationId: string;
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

  // Auto-continue loop: process chapters one at a time until all done or cancelled
  while (true) {
    // Check for cancellation before each chapter
    const currentJob = await getTranslationJobById(input.translationId);
    if (currentJob?.status === TranslationStatus.CANCELLED) {
      return toTranslationJobView(currentJob);
    }

    const pending = await listPendingChaptersForRun(input.translationId, 1);
    if (pending.length === 0) {
      break; // All chapters processed
    }

    const chapterState = pending[0];

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

  const retried = await getTranslationJobById(input.translationId);
  if (!retried) {
    throw new TranslationHttpError(404, "Translation job not found after retry preparation.");
  }

  return toTranslationJobView(retried);
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

export async function cancelTranslationJob(input: {
  translationId: string;
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

  if (!canCancelTranslationStatus(job.status)) {
    throw new TranslationHttpError(409, "Only active translation jobs can be cancelled.");
  }

  const cancelled = await setTranslationCancelled(input.translationId);
  return toTranslationJobView(cancelled);
}

export async function getLatestNovelTranslationJobView(novelId: string, userId: string) {
  const novel = await getNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }
  const job = await getLatestTranslationJobForNovel(novelId);
  return job ? toTranslationJobView(job) : null;
}
