import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHeartbeatFrame,
  createSseEventFrame,
  createTranslationEventStream,
  encodeSseFrame,
  sseComment,
  sseData,
  sseEvent,
  sseRetry,
  TRANSLATION_STREAM_CLEANUP_TIMEOUT_MS,
  TRANSLATION_STREAM_RETRY_MS,
} from "@/app/lib/translation/sse";
import type { ChapterTranslatedEvent } from "@/app/lib/translation/pubsub";

const { queuedRedisOverrides, redisInstances } = vi.hoisted(() => ({
  queuedRedisOverrides: [] as Array<Record<string, unknown>>,
  redisInstances: [] as Array<Record<string, unknown>>,
}));

vi.mock("ioredis", () => {
  class MockIORedis {
    url: string;
    options: unknown;
    subscribe = vi.fn().mockResolvedValue(1);
    unsubscribe = vi.fn().mockResolvedValue(0);
    quit = vi.fn().mockResolvedValue("OK");
    disconnect = vi.fn();
    handlers = new Map<string, Set<(...args: unknown[]) => void>>();

    constructor(url: string, options: unknown) {
      this.url = url;
      this.options = options;
      Object.assign(this, queuedRedisOverrides.shift() ?? {});
      redisInstances.push(this as unknown as Record<string, unknown>);
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      const handlers = this.handlers.get(event) ?? new Set<(...args: unknown[]) => void>();
      handlers.add(handler);
      this.handlers.set(event, handlers);
      return this;
    }

    off(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.get(event)?.delete(handler);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args);
      }
      return true;
    }
  }

  return { default: MockIORedis };
});

const textDecoder = new TextDecoder();
const REDIS_URL = "rediss://:pw@host.upstash.io:6379";
const TRANSLATION_ID = "job-123";
const CHANNEL = `translation:${TRANSLATION_ID}`;
const SNAPSHOT = {
  job: {
    id: TRANSLATION_ID,
    status: "IN_PROGRESS",
    completedChapters: 1,
    totalChapters: 3,
    progressPercent: 33,
    downloadUrl: null,
  },
  chapterStatuses: [
    {
      chapterIndex: 1,
      status: "translated",
      completedAt: "2026-04-17T00:00:00.000Z",
    },
    { chapterIndex: 2, status: "translating" },
  ],
};

function queueRedisInstance(overrides: Record<string, unknown>) {
  queuedRedisOverrides.push(overrides);
}

function latestRedisInstance() {
  const instance = redisInstances.at(-1);
  expect(instance).toBeTruthy();
  return instance!;
}

function validEvent(overrides: Partial<ChapterTranslatedEvent> = {}): ChapterTranslatedEvent {
  return {
    type: "chapter-translated",
    translationId: TRANSLATION_ID,
    chapterStatus: {
      chapterIndex: 2,
      status: "translated",
      completedAt: "2026-04-17T00:00:01.000Z",
      ...overrides.chapterStatus,
    },
    job: {
      id: TRANSLATION_ID,
      status: "IN_PROGRESS",
      completedChapters: 2,
      totalChapters: 3,
      updatedAt: "2026-04-17T00:00:01.000Z",
      ...overrides.job,
    },
    ...overrides,
  };
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const result = await reader.read();
  expect(result.done).toBe(false);
  expect(result.value).toBeTruthy();
  return textDecoder.decode(result.value);
}

describe("translation SSE helpers", () => {
  it("encodes a retry prelude followed by a named event and JSON data", () => {
    const chunk = encodeSseFrame(
      sseRetry(TRANSLATION_STREAM_RETRY_MS),
      sseEvent("snapshot"),
      sseData({
        job: { id: "job-1", status: "IN_PROGRESS" },
        chapterStatuses: [],
      })
    );

    expect(textDecoder.decode(chunk)).toBe(
      `retry: ${TRANSLATION_STREAM_RETRY_MS}\nevent: snapshot\ndata: ${JSON.stringify({
        job: { id: "job-1", status: "IN_PROGRESS" },
        chapterStatuses: [],
      })}\n\n`
    );
  });

  it("creates a named event frame with an optional retry line", () => {
    const chunk = createSseEventFrame(
      "snapshot",
      { job: { id: "job-2" }, chapterStatuses: [] },
      { retryMs: 20_000 }
    );

    expect(textDecoder.decode(chunk)).toBe(
      `retry: 20000\nevent: snapshot\ndata: ${JSON.stringify({
        job: { id: "job-2" },
        chapterStatuses: [],
      })}\n\n`
    );
  });

  it("creates heartbeat comment frames", () => {
    const chunk = createHeartbeatFrame();
    expect(textDecoder.decode(chunk)).toBe(`: heartbeat\n\n`);
  });

  it("supports custom comments", () => {
    const chunk = encodeSseFrame(sseComment("keepalive"));
    expect(textDecoder.decode(chunk)).toBe(`: keepalive\n\n`);
  });
});

describe("createTranslationEventStream", () => {
  const originalRedisUrl = process.env.UPSTASH_REDIS_URL;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    queuedRedisOverrides.length = 0;
    redisInstances.length = 0;
    process.env.UPSTASH_REDIS_URL = REDIS_URL;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalRedisUrl === undefined) {
      delete process.env.UPSTASH_REDIS_URL;
    } else {
      process.env.UPSTASH_REDIS_URL = originalRedisUrl;
    }
  });

  it("uses a dedicated subscriber connection, sends snapshot first, and preserves chapter event ordering", async () => {
    const stream = createTranslationEventStream({
      translationId: TRANSLATION_ID,
      snapshot: SNAPSHOT,
      signal: new AbortController().signal,
      heartbeatMs: 60_000,
    });
    const reader = stream.getReader();

    expect(await readChunk(reader)).toBe(
      `retry: ${TRANSLATION_STREAM_RETRY_MS}\nevent: snapshot\ndata: ${JSON.stringify(
        SNAPSHOT
      )}\n\n`
    );

    const redis = latestRedisInstance();
    expect(redis.url).toBe(REDIS_URL);
    expect(redis.options).toMatchObject({
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    expect(redis.subscribe).toHaveBeenCalledWith(CHANNEL);

    const firstEvent = validEvent({
      chapterStatus: {
        chapterIndex: 2,
        status: "translated",
        completedAt: "2026-04-17T00:00:01.000Z",
      },
      job: {
        id: TRANSLATION_ID,
        status: "IN_PROGRESS",
        completedChapters: 2,
        totalChapters: 3,
        updatedAt: "2026-04-17T00:00:01.000Z",
      },
    });
    const secondEvent = validEvent({
      chapterStatus: {
        chapterIndex: 3,
        status: "translated",
        completedAt: "2026-04-17T00:00:02.000Z",
      },
      job: {
        id: TRANSLATION_ID,
        status: "COMPLETED",
        completedChapters: 3,
        totalChapters: 3,
        updatedAt: "2026-04-17T00:00:02.000Z",
      },
    });

    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      JSON.stringify(firstEvent)
    );
    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      JSON.stringify(secondEvent)
    );

    expect(await readChunk(reader)).toBe(
      `event: chapter-translated\ndata: ${JSON.stringify(firstEvent)}\n\n`
    );
    expect(await readChunk(reader)).toBe(
      `event: chapter-translated\ndata: ${JSON.stringify(secondEvent)}\n\n`
    );
  });

  it("emits heartbeat comments while the stream is idle", async () => {
    const abortController = new AbortController();
    const stream = createTranslationEventStream({
      translationId: TRANSLATION_ID,
      snapshot: SNAPSHOT,
      signal: abortController.signal,
      heartbeatMs: 1_000,
    });
    const reader = stream.getReader();

    await readChunk(reader);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await readChunk(reader)).toBe(`: heartbeat\n\n`);

    abortController.abort();
    await vi.runAllTimersAsync();
  });

  it("logs malformed payloads, skips mismatched event types, and still relays later valid chapter events", async () => {
    const logger = { error: vi.fn() };
    const stream = createTranslationEventStream({
      translationId: TRANSLATION_ID,
      snapshot: SNAPSHOT,
      signal: new AbortController().signal,
      logger,
      heartbeatMs: 60_000,
    });
    const reader = stream.getReader();
    const redis = latestRedisInstance();

    await readChunk(reader);

    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      "{not-json"
    );
    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      JSON.stringify(["not", "an", "object"])
    );
    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      JSON.stringify({ ...validEvent(), type: "chapter-started" })
    );

    const event = validEvent({
      chapterStatus: {
        chapterIndex: 3,
        status: "translated",
        completedAt: "2026-04-17T00:00:03.000Z",
      },
      job: {
        id: TRANSLATION_ID,
        status: "COMPLETED",
        completedChapters: 3,
        totalChapters: 3,
        updatedAt: "2026-04-17T00:00:03.000Z",
      },
    });
    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      JSON.stringify(event)
    );

    expect(await readChunk(reader)).toBe(
      `event: chapter-translated\ndata: ${JSON.stringify(event)}\n\n`
    );
    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(logger.error.mock.calls[0][0]).toContain("Ignored Redis payload");
    expect(logger.error.mock.calls[1][0]).toContain("Ignored Redis payload");
    expect(logger.error.mock.calls[2][0]).toContain("Ignored Redis payload");
  });

  it("logs subscribe failures and closes the stream cleanly so the client can reconnect", async () => {
    queueRedisInstance({
      subscribe: vi.fn().mockRejectedValue(new Error("subscribe failed")),
    });
    const logger = { error: vi.fn() };
    const stream = createTranslationEventStream({
      translationId: TRANSLATION_ID,
      snapshot: SNAPSHOT,
      signal: new AbortController().signal,
      logger,
      heartbeatMs: 60_000,
    });
    const reader = stream.getReader();
    const redis = latestRedisInstance();

    expect(await readChunk(reader)).toContain("event: snapshot");

    const finalRead = await reader.read();
    expect(finalRead.done).toBe(true);
    expect(redis.unsubscribe).toHaveBeenCalledWith(CHANNEL);
    expect(redis.quit).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain("subscribe failed");
  });

  it("runs abort cleanup, unsubscribes, and falls back to disconnect when quit hangs", async () => {
    queueRedisInstance({
      quit: vi.fn(() => new Promise(() => undefined)),
    });
    const abortController = new AbortController();
    const logger = { error: vi.fn() };
    const stream = createTranslationEventStream({
      translationId: TRANSLATION_ID,
      snapshot: SNAPSHOT,
      signal: abortController.signal,
      logger,
      heartbeatMs: 60_000,
      cleanupTimeoutMs: 25,
    });
    const reader = stream.getReader();
    const redis = latestRedisInstance();

    await readChunk(reader);

    abortController.abort();
    await vi.advanceTimersByTimeAsync(25);

    expect(redis.unsubscribe).toHaveBeenCalledWith(CHANNEL);
    expect(redis.quit).toHaveBeenCalledTimes(1);
    expect(redis.disconnect).toHaveBeenCalledTimes(1);

    const finalRead = await reader.read();
    expect(finalRead.done).toBe(true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to release Redis subscriber cleanly"),
      expect.objectContaining({
        error: expect.stringContaining("quit() timed out after 25ms"),
      })
    );
  });

  it("uses the default cleanup timeout constant in tests and production code", () => {
    expect(TRANSLATION_STREAM_CLEANUP_TIMEOUT_MS).toBe(5_000);
  });
});
