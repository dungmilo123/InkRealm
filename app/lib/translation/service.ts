import { ChapterTranslationStatus as PrismaChapterTranslationStatus, TranslationStatus, type TranslationProvider, type Novel } from "@/app/generated/prisma/client";
import { getNovelById, cachedGetNovelById } from "@/app/lib/novels";
import {
  ReaderUnavailableError,
  getReaderDocument,
} from "@/app/lib/reader";
import { getTranslationAdapter } from "@/app/lib/translation/adapters";
import type { GlossaryPromptEntry, ChapterContext } from "@/app/lib/translation/adapters";
import {
  countNovelTranslatedChapters,
  countTranslatedChapters,
  createTranslationJobRecord,
  getChapterTranslationStatuses,
  getLatestTranslationJobForNovel,
  getNovelTranslatedChapter,
  getTranslationJobById,
  getTranslationJobForRunner,
  getTranslationJobWithOwnershipAndStatuses,
  listNovelTranslatedChapters,
  listPendingChaptersForRun,
  listPreviousTranslatedChapters,
  listTranslatedChaptersForExport,
  listTranslationJobsForNovel,
  listUntranslatedChapterIndices,
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
  upsertNovelTranslatedChapter,
  type TranslationJobSummary,
} from "@/app/lib/translation/data";
import { canDownloadTranslationExport, writeTranslatedExportFile } from "@/app/lib/translation/export";
import { buildTranslatedEpub } from "@/app/lib/translation/epub-export";
import { TranslationHttpError, toErrorMessage } from "@/app/lib/translation/errors";
import { publishChapterTranslated } from "@/app/lib/translation/pubsub";
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
    // Smart default: skip already-translated chapters using the per-novel table
    const translatedCount = await countNovelTranslatedChapters(novel.id);
    if (translatedCount > 0 && translatedCount < readerDocument.chapterCount) {
      const untranslatedIndices = await listUntranslatedChapterIndices(novel.id, readerDocument.chapterCount);
      chaptersToTranslate = readerDocument.chapters.filter(
        (ch) => untranslatedIndices.includes(ch.index)
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

export const MAX_RETRIES_PER_CHAPTER = 3;

/**
 * Translates all pending chapters of a translation job sequentially in a
 * single in-process loop. Per-chapter retry (3 attempts), cancellation
 * check between chapters, and progressive `completedChapters` updates.
 *
 * @returns the finalized job view when all chapters are done or on
 *   failure/cancellation.
 */
export async function runTranslationJob(input: {
  translationId: string;
  profileId?: string;
  allowFailedState?: boolean;
  userId: string;
}): Promise<TranslationJobView> {
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

  // Fetch all pending chapters and loop through them
  const pendingChapters = await listPendingChaptersForRun(input.translationId, runnerState.totalChapters);
  if (pendingChapters.length === 0) {
    return finalizeTranslationState({
      translationId: input.translationId,
      novelTitle: runnerState.novel.title,
    });
  }

  for (const chapterState of pendingChapters) {
    // Check for cancellation between chapters
    const currentJob = await getTranslationJobById(input.translationId);
    if (currentJob?.status === TranslationStatus.CANCELLED) {
      return toTranslationJobView(currentJob);
    }

    const claimed = await markChapterTranslating(
      input.translationId,
      chapterState.chapterIndex
    );
    if (!claimed) {
      continue; // skip if already claimed
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

    // Per-chapter retry loop
    let chapterSuccess = false;
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_CHAPTER; attempt++) {
      try {
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

        // Upsert into the per-novel translated chapter table (source of truth)
        await upsertNovelTranslatedChapter({
          novelId: runnerState.novelId,
          chapterIndex: chapterState.chapterIndex,
          translatedTitle: translated.translatedTitle,
          translatedContent: translated.translatedContent,
          summary: translated.chapterSummary ?? null,
          translationId: input.translationId,
        });

        if (translated.chapterSummary) {
          await updateChapterSummary(
            input.translationId,
            chapterState.chapterIndex,
            translated.chapterSummary
          );
        }

        if (translated.detectedTerms && translated.detectedTerms.length > 0 && runnerState.useGlossary) {
          const newEntries = await createPendingGlossaryEntries({
            novelId: runnerState.novelId,
            terms: translated.detectedTerms,
          });
          if (newEntries.length > 0) {
            console.log("Created glossary entries", {
              translationId: input.translationId,
              chapterIndex: chapterState.chapterIndex,
              count: newEntries.length,
            });
          }
        }

        // Increment completedChapters for real-time polling
        const translatedCount = await countTranslatedChapters(input.translationId);
        const updatedJob = await updateTranslationCompletedCount(input.translationId, translatedCount);

        // Publish chapter-translated event for real-time SSE consumers (R028).
        // publishChapterTranslated handles errors internally — never throws (R031).
        // Defense-in-depth: wrap in try/catch so a hypothetical escape never
        // breaks the translation loop.
        try {
          await publishChapterTranslated({
            type: "chapter-translated",
            translationId: input.translationId,
            chapterStatus: {
              chapterIndex: chapterState.chapterIndex,
              status: "translated",
              completedAt: new Date().toISOString(),
            },
            job: {
              id: updatedJob.id,
              status: updatedJob.status,
              completedChapters: updatedJob.completedChapters,
              totalChapters: updatedJob.totalChapters,
              updatedAt: updatedJob.updatedAt instanceof Date
                ? updatedJob.updatedAt.toISOString()
                : String(updatedJob.updatedAt),
            },
          });
        } catch {
          // Swallow — publish must never fail the translation (R031)
        }

        chapterSuccess = true;
        break;
      } catch (error) {
        console.error(`Translation attempt ${attempt}/${MAX_RETRIES_PER_CHAPTER} failed for chapter ${chapterState.chapterIndex}`, {
          translationId: input.translationId,
          chapterIndex: chapterState.chapterIndex,
          attempt,
          error: toErrorMessage(error),
        });

        if (attempt === MAX_RETRIES_PER_CHAPTER) {
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
    }

    if (!chapterSuccess) {
      // Should not reach here due to the return in the catch block above,
      // but guard against unexpected flow
      break;
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
 * Does not re-run the job — call {@link runTranslationJob} afterward.
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
 * Aggregates across ALL completed translation jobs so chapters translated
 * in earlier jobs are still visible. Also includes statuses from the
 * latest active job (if any) to show in-progress/pending chapters.
 */
export async function getInitialChapterStatuses(novelId: string, userId: string): Promise<ChapterStatusItem[]> {
  const novel = await cachedGetNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    return [];
  }

  // Gather translated chapters from the per-novel source-of-truth table
  const translatedRows = await listNovelTranslatedChapters(novelId);
  const translatedMap = new Map<number, { status: "translated" | "translating" | "untranslated"; summary: string | null }>(
    translatedRows.map((row) => [
      row.chapterIndex,
      { status: "translated" as const, summary: row.summary },
    ])
  );

  // Also include statuses from the latest job (may be in-progress)
  const latestJob = await getLatestTranslationJobForNovel(novelId);
  if (latestJob) {
    const rawStatuses = await getChapterTranslationStatuses(latestJob.id);
    for (const ch of rawStatuses) {
      const mapped = mapChapterStatus(ch.status);
      // Latest job's statuses take precedence (shows in-progress/pending)
      // unless the chapter is already translated from a completed job
      // and the latest job hasn't translated it yet.
      // "translating" is also allowed to override "translated" to reflect
      // active reruns correctly.
      if (mapped === "translated" || mapped === "translating" || !translatedMap.has(ch.chapterIndex)) {
        translatedMap.set(ch.chapterIndex, {
          status: mapped,
          summary: ch.summary ?? null,
        });
      }
    }
  }

  return Array.from(translatedMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([chapterIndex, { status, summary }]) => ({
      chapterIndex,
      status,
      ...(summary ? { summary } : {}),
    }));
}

/**
 * Loads a translated chapter's content for the reader view.
 * Searches across ALL translation jobs for the novel and
 * returns the most recently translated version, or `null` if the
 * chapter hasn't been translated in any job.
 */
export async function getTranslatedChapterForReader(
  novelId: string,
  chapterIndex: number,
  userId: string
): Promise<{ translatedTitle: string; translatedParagraphs: string[] } | null> {
  const novel = await cachedGetNovelById(novelId);
  if (!novel || novel.userId !== userId) return null;

  const chapter = await getNovelTranslatedChapter(novelId, chapterIndex);
  if (!chapter || !chapter.translatedContent) return null;

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


/**
 * Creates a new translation job for untranslated chapters of a novel,
 * reusing the provider/model config from the latest job.
 * Used by the "Continue (N remaining)" button.
 */
export async function continueTranslation(novelId: string, userId: string) {
  const novel = await getNovelById(novelId);
  if (!novel || novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }

  if (!novel.chapterCount || novel.chapterCount === 0) {
    throw new TranslationHttpError(400, "Novel has no chapters.");
  }

  const latestJob = await getLatestTranslationJobForNovel(novelId);
  if (!latestJob) {
    throw new TranslationHttpError(400, "No previous translation job found. Start a new translation instead.");
  }

  const untranslatedIndices = await listUntranslatedChapterIndices(novelId, novel.chapterCount);
  if (untranslatedIndices.length === 0) {
    throw new TranslationHttpError(400, "All chapters are already translated.");
  }

  // Read the novel to get chapter titles
  let readerDocument: Awaited<ReturnType<typeof getReaderDocument>>;
  try {
    readerDocument = await getReaderDocument(novel);
  } catch (error) {
    if (error instanceof ReaderUnavailableError) {
      throw new TranslationHttpError(400, error.message);
    }
    throw error;
  }

  const quality = resolveQualityPreset("premium");

  const chaptersToTranslate = readerDocument.chapters.filter(
    (ch) => untranslatedIndices.includes(ch.index)
  );

  if (chaptersToTranslate.length === 0) {
    throw new TranslationHttpError(400, "No untranslated chapters found.");
  }

  const created = await createTranslationJobRecord({
    novelId: novel.id,
    targetLanguage: "Vietnamese",
    providerSnapshot: latestJob.providerSnapshot,
    modelSnapshot: latestJob.modelSnapshot,
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