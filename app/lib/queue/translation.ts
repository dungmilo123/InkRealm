import { Queue } from "bullmq";
import type { ConnectionOptions, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { TranslationHttpError } from "@/app/lib/translation/errors";

// ---------------------------------------------------------------------------
// Queue & job constants
// ---------------------------------------------------------------------------

export const TRANSLATION_QUEUE_NAME = "translation" as const;
export const TRANSLATION_QUEUE_JOB_NAME = "translate-novel" as const;

// ---------------------------------------------------------------------------
// Job payload contract — shared between producer (this file) and future worker
// ---------------------------------------------------------------------------

export interface TranslationQueueJobData {
  translationId: string;
  userId: string;
  profileId?: string;
  /** When true the worker must accept a FAILED-state job and re-run it. */
  allowFailedState?: boolean;
}

// ---------------------------------------------------------------------------
// Default BullMQ job options — used by enqueueTranslationJob
// ---------------------------------------------------------------------------

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 30_000, // 30 s initial, then 60 s, 120 s
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

// ---------------------------------------------------------------------------
// Lazy singleton helpers (survive hot reload in dev)
// ---------------------------------------------------------------------------

const globalForQueue = globalThis as unknown as {
  __translationRedis?: IORedis;
  __translationQueue?: Queue;
};

/**
 * Validates the `UPSTASH_REDIS_URL` env var lazily — only called when a queue
 * operation actually needs a connection.  Importing this module does NOT crash
 * unrelated code paths.
 */
function getRedisUrl(): string {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) {
    throw new TranslationHttpError(
      500,
      "Translation queue is not configured (missing UPSTASH_REDIS_URL).",
    );
  }
  if (!/^rediss?:\/\//.test(url)) {
    throw new TranslationHttpError(
      500,
      "Invalid UPSTASH_REDIS_URL: must start with redis:// or rediss://.",
    );
  }
  return url;
}

function getRedisConnection(): IORedis {
  if (globalForQueue.__translationRedis) {
    return globalForQueue.__translationRedis;
  }

  const url = getRedisUrl();
  const client = new IORedis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForQueue.__translationRedis = client;
  }

  return client;
}

function getTranslationQueue(): Queue {
  if (globalForQueue.__translationQueue) {
    return globalForQueue.__translationQueue;
  }

  const connection = getRedisConnection() as unknown as ConnectionOptions;
  const queue = new Queue(TRANSLATION_QUEUE_NAME, { connection });

  if (process.env.NODE_ENV !== "production") {
    globalForQueue.__translationQueue = queue;
  }

  return queue;
}

// ---------------------------------------------------------------------------
// Public enqueue helper
// ---------------------------------------------------------------------------

/**
 * Enqueues a translation job onto the BullMQ queue backed by Upstash Redis.
 *
 * - Validates `UPSTASH_REDIS_URL` lazily (no crash on import).
 * - Waits for BullMQ readiness so failures surface inside the request
 *   lifecycle rather than silently vanishing.
 * - Uses `jobId: translationId` to make enqueues idempotent.
 *
 * @throws {TranslationHttpError} on config, readiness, or enqueue failures
 */
export async function enqueueTranslationJob(
  data: TranslationQueueJobData,
): Promise<{ jobId: string }> {
  if (!data.translationId) {
    throw new TranslationHttpError(400, "Missing translationId for queue job.");
  }
  if (!data.userId) {
    throw new TranslationHttpError(400, "Missing userId for queue job.");
  }

  const queue = getTranslationQueue();

  try {
    await queue.waitUntilReady();
  } catch (error) {
    throw new TranslationHttpError(
      500,
      `Translation queue is not reachable: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  try {
    const job = await queue.add(TRANSLATION_QUEUE_JOB_NAME, data, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: data.translationId,
    });

    return { jobId: job.id ?? data.translationId };
  } catch (error) {
    throw new TranslationHttpError(
      500,
      `Failed to enqueue translation job: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
