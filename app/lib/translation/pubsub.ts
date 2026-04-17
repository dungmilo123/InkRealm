import IORedis from "ioredis";

// ---------------------------------------------------------------------------
// Pub/Sub channel naming
// ---------------------------------------------------------------------------

/**
 * Returns the Redis Pub/Sub channel for a specific translation job.
 * Consumers subscribe to `translation:{translationId}` to receive
 * real-time chapter progress events.
 */
export function getTranslationChannel(translationId: string): string {
  return `translation:${translationId}`;
}

// ---------------------------------------------------------------------------
// Event payload contract
// ---------------------------------------------------------------------------

export interface ChapterTranslatedEvent {
  type: "chapter-translated";
  translationId: string;
  chapterStatus: {
    chapterIndex: number;
    status: "translated";
    completedAt: string; // ISO-8601
  };
  job: {
    id: string;
    status: string;
    completedChapters: number;
    totalChapters: number;
    updatedAt: string; // ISO-8601
  };
}

// ---------------------------------------------------------------------------
// Lazy singleton publisher connection (survives hot reload in dev)
// ---------------------------------------------------------------------------

const globalForPublisher = globalThis as unknown as {
  __translationPublisher?: IORedis;
};

/**
 * Validates `UPSTASH_REDIS_URL` exists and has a valid Redis scheme.
 * Returns the URL string or throws on misconfiguration.
 */
function getRedisUrl(): string {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) {
    throw new Error(
      "Pub/Sub publisher is not configured (missing UPSTASH_REDIS_URL).",
    );
  }
  if (!/^rediss?:\/\//.test(url)) {
    throw new Error(
      "Invalid UPSTASH_REDIS_URL: must start with redis:// or rediss://.",
    );
  }
  return url;
}

/**
 * Returns a lazy ioredis singleton dedicated to Pub/Sub publishing.
 * Separate from the BullMQ connection — ioredis requires distinct clients
 * for pub/sub vs. command usage.
 */
function getPublisherConnection(): IORedis {
  if (globalForPublisher.__translationPublisher) {
    return globalForPublisher.__translationPublisher;
  }

  const url = getRedisUrl();
  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  globalForPublisher.__translationPublisher = client;

  return client;
}

// ---------------------------------------------------------------------------
// Public publish helper — NEVER throws (R031 contract)
// ---------------------------------------------------------------------------

/**
 * Publishes a chapter-translated event to the translation channel.
 *
 * **Error isolation (R031):** The entire body is wrapped in try/catch.
 * Publish failures are logged via `console.error` and swallowed — they
 * must never fail the translation worker.
 */
export async function publishChapterTranslated(
  event: ChapterTranslatedEvent,
): Promise<void> {
  try {
    const redis = getPublisherConnection();
    const channel = getTranslationChannel(event.translationId);
    await redis.publish(channel, JSON.stringify(event));
    console.log(
      `[pubsub] Published chapter-translated to ${channel} (chapterIndex=${event.chapterStatus.chapterIndex})`,
    );
  } catch (error) {
    console.error(
      `[pubsub] Failed to publish chapter-translated for translationId=${event.translationId} chapterIndex=${event.chapterStatus.chapterIndex}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
