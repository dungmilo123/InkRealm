import type { Job } from "bullmq";
import type { TranslationQueueJobData } from "@/app/lib/queue/translation";
import { runTranslationJob } from "@/app/lib/translation/service";
import {
  getTranslationJobById,
  setTranslationFailed,
} from "@/app/lib/translation/data";

// ---------------------------------------------------------------------------
// Processor — thin seam between BullMQ and the translation runner
// ---------------------------------------------------------------------------

/**
 * BullMQ processor callback. Forwards the job payload to
 * `runTranslationJob()` and lets exceptions bubble so BullMQ can
 * handle retries with its own backoff/attempts config.
 */
export async function processTranslationJob(
  job: Job<TranslationQueueJobData>,
): Promise<void> {
  const { translationId, userId, profileId, allowFailedState } = job.data;

  await runTranslationJob({
    translationId,
    userId,
    profileId,
    allowFailedState,
  });
}

// ---------------------------------------------------------------------------
// Terminal-failure handler — runs when BullMQ exhausts all retries
// ---------------------------------------------------------------------------

/**
 * Called by BullMQ's `worker.on('failed')` when `job.attemptsMade >= job.opts.attempts`.
 * Marks the DB translation as FAILED **only** when it hasn't already been
 * moved to CANCELLED or COMPLETED by a concurrent user action (state-guard).
 *
 * This function must **never throw** — BullMQ has already recorded the job
 * as failed in its own Redis set, so an exception here would be an
 * unhandled rejection with no upside.
 */
export async function handleTerminalFailure(
  job: Job<TranslationQueueJobData>,
  error: Error,
): Promise<void> {
  const { translationId } = job.data;
  const prefix = `[terminal-failure] translation=${translationId}`;

  try {
    const translation = await getTranslationJobById(translationId);

    if (!translation) {
      console.error(`${prefix} — translation not found in DB, skipping terminal write`);
      return;
    }

    // State guard: never downgrade CANCELLED or COMPLETED to FAILED
    if (translation.status === "CANCELLED" || translation.status === "COMPLETED") {
      console.log(
        `${prefix} — skipping terminal write, current status is ${translation.status}`,
      );
      return;
    }

    // Preserve the existing failedChapterIndex from a partial run (if any),
    // otherwise default to 1.
    const failedChapterIndex = translation.failedChapterIndex ?? 1;
    const failureReason = error.message.slice(0, 1000);

    await setTranslationFailed({
      translationId,
      failedChapterIndex,
      failureReason,
    });
  } catch (dbError) {
    // Best-effort — never throw from the terminal handler
    console.error(
      `${prefix} — DB error in terminal-failure handler:`,
      dbError instanceof Error ? dbError.message : dbError,
    );
  }
}
