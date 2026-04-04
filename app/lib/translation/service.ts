import { ChapterTranslationStatus as PrismaChapterTranslationStatus, TranslationStatus, type TranslationProvider, type Novel } from "@/app/generated/prisma/client";
import { getNovelById, cachedGetNovelById } from "@/app/lib/novels";
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
  getChapterTranslationStatuses,
  getLatestTranslationJobForNovel,
  getTranslatedChapterContent,
  getTranslationJobById,
  getTranslationJobForRunner,
  getTranslationJobWithOwnershipAndStatuses,
  listPendingChaptersForRun,
  listPreviousTranslatedChapters,
  listTranslatedChaptersForExport,
  listTranslationJobsForNovel,
  markChapterFailed,
  markChapterTranslated,
  markChapterTranslating,
  prepareTranslationRetry,
  resetStalledTranslatingChapters,
  setTranslationCancelled,
  setTranslationCompleted,
  setTranslationFailed,
  setTranslationInProgress,
  updateChapterSummary,
  updateTranslationCompletedCount,
  type TranslationJobSummary,
} from "@/app/lib/translation/data";
import { canDownloadTranslationExport, writeTranslatedExportFile } from "@/app/lib/translation/export";
import { buildTranslatedEpub } from "@/app/lib/translation/epub-export";
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

export type ChapterStatusItem = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
  /** ISO timestamp when this chapter finished translating (only present for translated chapters) */
  completedAt?: string;
  /** AI-generated chapter summary (~100-200 words). Only present for translated chapters. */
  summary?: string | null;
};

function mapChapterStatus(prismaStatus: PrismaChapterTranslationStatus): "translated" | "translating" | "untranslated" {
  switch (prismaStatus) {
    case "TRANSLATED": return "translated";
    case "TRANSLATING": return "translating";
    case "PENDING":
    case "FAILED":
    default: return "untranslated";
  }
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

/** Lists all translation jobs for a novel, enriched with progress percentage and download URL. */
export async function listNovelTranslationJobViews(novelId: string, userId: string) {
  const novel = await getNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }
  const jobs = await listTranslationJobsForNovel(novelId);
  return jobs.map(toTranslationJobView);
}

/**
 * Creates a new translation job for a novel.
 * Parses the novel's source file, determines which chapters to translate
 * (respecting optional `chapterFrom`/`chapterTo` range or skipping
 * already-translated chapters from prior completed jobs), and inserts
 * the job + chapter records.
 *
 * @throws {TranslationHttpError} 404 if novel not found / not owned by user
 * @throws {TranslationHttpError} 400 if file can't be parsed or no chapters to translate
 */
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

/**
 * Maximum wall-clock time (ms) the batch loop will run before triggering
 * a continuation via internal fetch. Leaves headroom below Vercel's
 * default 300 s function timeout so the continuation request can be fired.
 */
const BATCH_TIME_BUDGET_MS = 240_000; // 4 minutes

/**
 * Builds the base URL for internal API calls.
 * Uses VERCEL_URL on deployed environments, falls back to localhost for dev.
 */
function getInternalBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Fires an internal fetch to the continuation endpoint so the next
 * function invocation picks up where this one left off.
 */
export async function triggerTranslationContinuation(input: {
  translationId: string;
  userId: string;
}) {
  const url = `${getInternalBaseUrl()}/api/translation/jobs/${input.translationId}/continue`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": process.env.AUTH_SECRET ?? "",
      },
      body: JSON.stringify({ userId: input.userId }),
    });
  } catch (error) {
    console.error("Failed to trigger translation continuation", {
      translationId: input.translationId,
      error,
    });
  }
}

/**
 * Sequentially translates pending chapters in a translation job.
 *
 * Runs in a while-loop, processing one chapter at a time. Checks a
 * time budget after each chapter — when approaching the function timeout,
 * it returns `"continue"` so the caller can trigger a continuation via
 * an internal fetch to a fresh function invocation.
 *
 * @returns `"completed"` when all chapters are done, `"continue"` when
 *   the time budget is exhausted and more chapters remain, or the
 *   finalized job view on failure/cancellation.
 */
export async function runTranslationJobBatch(input: {
  translationId: string;
  profileId?: string;
  allowFailedState?: boolean;
  userId: string;
}): Promise<TranslationJobView | "continue"> {
  const batchStart = Date.now();
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
    readerDocument = await getReaderDocument(runnerState.novel as unknown as Novel);
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

  // Recover any chapters left in TRANSLATING from a prior interrupted invocation
  await resetStalledTranslatingChapters(input.translationId);

  // Auto-continue loop: process chapters one at a time until all done, cancelled, or time budget exhausted
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

    // Check time budget — if running low, yield to a fresh invocation
    if (Date.now() - batchStart > BATCH_TIME_BUDGET_MS) {
      return "continue";
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

    try {
      // Assemble context from previous chapters (inside try/catch to prevent silent crashes)
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

      const translated = await adapter.translateChapter(
        {
          provider: runnerState.providerSnapshot,
          model: runnerState.modelSnapshot,
          apiKey: credential.apiKey,
          baseUrl: credential.baseUrl,
          customPrompt: credential.customPrompt,
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

/**
 * Prepares a failed translation job for re-running by resetting failed
 * and in-progress chapters back to PENDING.
 * Does not re-run the job — call {@link runTranslationJobBatch} afterward.
 */
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

/** Returns the job summary and per-chapter status/completion timestamps for the polling UI. */
export async function getTranslationJobStatus(translationId: string, userId: string) {
  const result = await getTranslationJobWithOwnershipAndStatuses(translationId, userId);
  if (!result) {
    throw new TranslationHttpError(404, "Translation job not found.");
  }

  const { chapters, ...jobData } = result;
  const chapterStatuses: ChapterStatusItem[] = chapters.map((ch) => {
    const status = mapChapterStatus(ch.status);
    return {
      chapterIndex: ch.chapterIndex,
      status,
      // Include completedAt for translated chapters — enables client-side ETA calculation
      ...(status === "translated" ? { completedAt: ch.updatedAt.toISOString() } : {}),
    };
  });

  return { job: toTranslationJobView(jobData), chapterStatuses };
}

/**
 * Fetches a translation job after verifying ownership and confirming that
 * an export file is available for download.
 * @throws {TranslationHttpError} 404 if not found, not owned, or no export available
 */
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

/**
 * Generates an EPUB buffer on-demand for a completed translation.
 * Unlike the TXT export (pre-generated at finalization), the EPUB is assembled
 * in memory each time since it requires ZIP construction and XHTML formatting.
 */
export async function buildEpubExportForJob(translationId: string, novelId: string) {
  const novel = await getNovelById(novelId);
  if (!novel) {
    throw new TranslationHttpError(404, "Novel not found.");
  }

  const chapters = await listTranslatedChaptersForExport(translationId);
  if (chapters.length === 0) {
    throw new TranslationHttpError(404, "No translated chapters available for export.");
  }

  const job = await getTranslationJobById(translationId);
  const targetLanguage = job?.targetLanguage ?? "Vietnamese";

  const buffer = buildTranslatedEpub({
    translationId,
    novelTitle: novel.title,
    targetLanguage,
    chapters,
  });

  const safeTitle = novel.title
    .replace(/[^a-zA-Z0-9\-\s_]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "novel";
  const safeLang = targetLanguage.toLowerCase();
  const fileName = `${safeTitle}-${safeLang}-${translationId}.epub`;

  return { buffer, fileName };
}

/** Cancels an active (PENDING or IN_PROGRESS) translation job. */
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

/** Returns the most recent translation job view for a novel, or `null` if none exist. */
export async function getLatestNovelTranslationJobView(novelId: string, userId: string) {
  const novel = await cachedGetNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }
  const job = await getLatestTranslationJobForNovel(novelId);
  return job ? toTranslationJobView(job) : null;
}

/**
 * Returns initial per-chapter translation statuses for the novel detail page.
 * Used to show chapter translation badges before the polling loop starts.
 */
export async function getInitialChapterStatuses(novelId: string, userId: string): Promise<ChapterStatusItem[]> {
  const novel = await cachedGetNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    return [];
  }
  const job = await getLatestTranslationJobForNovel(novelId);
  if (!job) return [];

  const rawStatuses = await getChapterTranslationStatuses(job.id);
  return rawStatuses.map((ch) => ({
    chapterIndex: ch.chapterIndex,
    status: mapChapterStatus(ch.status),
    ...(ch.summary ? { summary: ch.summary } : {}),
  }));
}

/**
 * Loads a translated chapter's content for the reader view.
 * Returns the translated title and paragraph array, or `null` if the
 * chapter hasn't been translated yet.
 */
export async function getTranslatedChapterForReader(
  novelId: string,
  chapterIndex: number,
  userId: string
): Promise<{ translatedTitle: string; translatedParagraphs: string[] } | null> {
  const novel = await cachedGetNovelById(novelId);
  if (!novel || novel.userId !== userId) return null;

  const job = await getLatestTranslationJobForNovel(novelId);
  if (!job) return null;

  const chapter = await getTranslatedChapterContent(job.id, chapterIndex);
  if (!chapter || chapter.status !== "TRANSLATED" || !chapter.translatedContent) return null;

  // Split translatedContent into paragraphs (stored as newline-separated text)
  const translatedParagraphs = chapter.translatedContent
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    translatedTitle: chapter.translatedTitle ?? "",
    translatedParagraphs,
  };
}
