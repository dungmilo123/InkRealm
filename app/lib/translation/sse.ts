import IORedis from "ioredis";
import {
  getTranslationChannel,
  type ChapterTranslatedEvent,
} from "@/app/lib/translation/pubsub";

export const TRANSLATION_STREAM_RETRY_MS = 15_000;
export const TRANSLATION_STREAM_HEARTBEAT_MS = 30_000;
export const TRANSLATION_STREAM_CLEANUP_TIMEOUT_MS = 5_000;

export const TRANSLATION_SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const TRANSLATION_PUBSUB_REDIS_OPTIONS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
} as const;

const textEncoder = new TextEncoder();

type TranslationStreamLogger = Pick<Console, "error">;

type CreateTranslationEventStreamInput = {
  translationId: string;
  snapshot: unknown;
  signal: AbortSignal;
  logger?: TranslationStreamLogger;
  heartbeatMs?: number;
  retryMs?: number;
  cleanupTimeoutMs?: number;
};

export function sseEvent(name: string) {
  return `event: ${name}`;
}

export function sseData(payload: unknown) {
  return `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
}

export function sseComment(comment = "heartbeat") {
  return `: ${comment}`;
}

export function sseRetry(ms = TRANSLATION_STREAM_RETRY_MS) {
  return `retry: ${ms}`;
}

export function encodeSseFrame(...lines: string[]) {
  return textEncoder.encode(`${lines.join("\n")}\n\n`);
}

export function createSseEventFrame(
  eventName: string,
  payload: unknown,
  options: { retryMs?: number } = {}
) {
  const lines = [
    ...(options.retryMs !== undefined ? [sseRetry(options.retryMs)] : []),
    sseEvent(eventName),
    sseData(payload),
  ];

  return encodeSseFrame(...lines);
}

export function createHeartbeatFrame(comment = "heartbeat") {
  return encodeSseFrame(sseComment(comment));
}

function getRedisUrl(): string {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) {
    throw new Error(
      "Translation stream subscriber is not configured (missing UPSTASH_REDIS_URL)."
    );
  }
  if (!/^rediss?:\/\//.test(url)) {
    throw new Error(
      "Invalid UPSTASH_REDIS_URL: must start with redis:// or rediss://."
    );
  }
  return url;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChapterTranslatedEvent(payload: unknown): payload is ChapterTranslatedEvent {
  if (!isRecord(payload)) {
    return false;
  }

  const chapterStatus = payload.chapterStatus;
  const job = payload.job;

  if (!isRecord(chapterStatus) || !isRecord(job)) {
    return false;
  }

  return (
    payload.type === "chapter-translated" &&
    typeof payload.translationId === "string" &&
    typeof chapterStatus.chapterIndex === "number" &&
    chapterStatus.status === "translated" &&
    typeof chapterStatus.completedAt === "string" &&
    typeof job.id === "string" &&
    typeof job.status === "string" &&
    typeof job.completedChapters === "number" &&
    typeof job.totalChapters === "number" &&
    typeof job.updatedAt === "string"
  );
}

function parseChapterTranslatedEvent(
  rawPayload: string,
  translationId: string
):
  | { ok: true; event: ChapterTranslatedEvent }
  | { ok: false; reason: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawPayload);
  } catch (error) {
    return {
      ok: false,
      reason: `invalid JSON (${toErrorMessage(error)})`,
    };
  }

  if (!isChapterTranslatedEvent(parsed)) {
    return {
      ok: false,
      reason: "unexpected event contract",
    };
  }

  if (parsed.translationId !== translationId) {
    return {
      ok: false,
      reason: `mismatched translationId=${parsed.translationId}`,
    };
  }

  return { ok: true, event: parsed };
}

async function quitSubscriberWithTimeout(input: {
  subscriber: IORedis;
  translationId: string;
  channel: string;
  cleanupTimeoutMs: number;
  logger: TranslationStreamLogger;
}) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`quit() timed out after ${input.cleanupTimeoutMs}ms`));
    }, input.cleanupTimeoutMs);

    timeoutHandle.unref?.();
  });

  try {
    await Promise.race([input.subscriber.quit(), timeout]);
  } catch (error) {
    input.logger.error(
      `[translation-sse] Failed to release Redis subscriber cleanly for translationId=${input.translationId} channel=${input.channel}.`,
      { error: toErrorMessage(error) }
    );
    input.subscriber.disconnect();
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function createTranslationEventStream(
  input: CreateTranslationEventStreamInput
): ReadableStream<Uint8Array> {
  const channel = getTranslationChannel(input.translationId);
  const logger = input.logger ?? console;
  const heartbeatMs = input.heartbeatMs ?? TRANSLATION_STREAM_HEARTBEAT_MS;
  const retryMs = input.retryMs ?? TRANSLATION_STREAM_RETRY_MS;
  const cleanupTimeoutMs =
    input.cleanupTimeoutMs ?? TRANSLATION_STREAM_CLEANUP_TIMEOUT_MS;

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let abortListener: (() => void) | null = null;
  let subscriber: IORedis | null = null;
  let cleanupPromise: Promise<void> | null = null;
  let cleanupStream: (() => Promise<void>) | null = null;
  let closeController: (() => void) | null = null;
  let settled = false;
  let handleMessage:
    | ((messageChannel: string, messagePayload: string) => void)
    | null = null;
  let handleSubscriberError: ((error: unknown) => void) | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      closeController = () => {
        if (settled) {
          return;
        }

        settled = true;
        try {
          controller.close();
        } catch {
          // The consumer may already have cancelled the stream.
        }
      };

      cleanupStream = async () => {
        if (cleanupPromise) {
          return cleanupPromise;
        }

        cleanupPromise = (async () => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }

          if (abortListener) {
            input.signal.removeEventListener("abort", abortListener);
            abortListener = null;
          }

          if (!subscriber) {
            return;
          }

          if (handleMessage) {
            subscriber.off("message", handleMessage);
            handleMessage = null;
          }

          if (handleSubscriberError) {
            subscriber.off("error", handleSubscriberError);
            handleSubscriberError = null;
          }

          try {
            await subscriber.unsubscribe(channel);
          } catch (error) {
            logger.error(
              `[translation-sse] Failed to unsubscribe Redis subscriber for translationId=${input.translationId} channel=${channel}.`,
              { error: toErrorMessage(error) }
            );
          }

          await quitSubscriberWithTimeout({
            subscriber,
            translationId: input.translationId,
            channel,
            cleanupTimeoutMs,
            logger,
          });

          subscriber = null;
        })();

        return cleanupPromise;
      };

      const cleanupAndClose = async () => {
        await cleanupStream?.();
        closeController?.();
      };

      const failStream = async (stage: string, error: unknown) => {
        logger.error(
          `[translation-sse] ${stage} failed for translationId=${input.translationId} channel=${channel}.`,
          { error: toErrorMessage(error) }
        );
        await cleanupAndClose();
      };

      controller.enqueue(
        createSseEventFrame("snapshot", input.snapshot, {
          retryMs,
        })
      );

      abortListener = () => {
        void cleanupAndClose();
      };
      input.signal.addEventListener("abort", abortListener, { once: true });

      if (input.signal.aborted) {
        abortListener();
        return;
      }

      try {
        subscriber = new IORedis(getRedisUrl(), TRANSLATION_PUBSUB_REDIS_OPTIONS);
      } catch (error) {
        await failStream("subscriber setup", error);
        return;
      }

      handleMessage = (messageChannel: string, messagePayload: string) => {
        if (settled || messageChannel !== channel) {
          return;
        }

        const parsed = parseChapterTranslatedEvent(
          messagePayload,
          input.translationId
        );
        if (!parsed.ok) {
          logger.error(
            `[translation-sse] Ignored Redis payload for translationId=${input.translationId} channel=${channel}.`,
            { reason: parsed.reason }
          );
          return;
        }

        try {
          controller.enqueue(
            createSseEventFrame("chapter-translated", parsed.event)
          );
        } catch (error) {
          void failStream("message enqueue", error);
        }
      };

      handleSubscriberError = (error: unknown) => {
        void failStream("subscriber error", error);
      };

      subscriber.on("message", handleMessage);
      subscriber.on("error", handleSubscriberError);

      try {
        await subscriber.subscribe(channel);
      } catch (error) {
        await failStream("subscribe", error);
        return;
      }

      if (settled) {
        await cleanupStream?.();
        return;
      }

      heartbeatTimer = setInterval(() => {
        if (settled) {
          return;
        }

        try {
          controller.enqueue(createHeartbeatFrame());
        } catch (error) {
          void failStream("heartbeat enqueue", error);
        }
      }, heartbeatMs);

      heartbeatTimer.unref?.();
    },
    async cancel() {
      await cleanupStream?.();
      closeController?.();
    },
  });
}
