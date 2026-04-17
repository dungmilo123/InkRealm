import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import { TRANSLATION_STREAM_RETRY_MS } from "@/app/lib/translation/sse";
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

const mockRequireAuth = vi.fn();
vi.mock("@/app/lib/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockGetTranslationJobStatus = vi.fn();
vi.mock("@/app/lib/translation/service", () => ({
  getTranslationJobStatus: (...args: unknown[]) =>
    mockGetTranslationJobStatus(...args),
}));

const mockHandleTranslationRouteError = vi.fn((error: unknown) => {
  if (error instanceof TranslationHttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Unexpected error" }, { status: 500 });
});
vi.mock("@/app/lib/translation/http", () => ({
  handleTranslationRouteError: (...args: unknown[]) =>
    mockHandleTranslationRouteError(...args),
}));

const mockGetClientIp = vi.fn();
const mockCheck = vi.fn();
const mockRateLimitResponse = vi.fn();
vi.mock("@/app/lib/rate-limit", () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
  rateLimitResponse: (...args: unknown[]) => mockRateLimitResponse(...args),
  translationStreamLimiter: {
    check: (...args: unknown[]) => mockCheck(...args),
  },
}));

import { GET, runtime } from "@/app/api/translation/jobs/[translationId]/stream/route";

const textDecoder = new TextDecoder();
const SESSION = { user: { id: "user-123" } };
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
    { chapterIndex: 1, status: "translated", completedAt: "2026-04-17T00:00:00.000Z" },
    { chapterIndex: 2, status: "translating" },
  ],
};
const CHAPTER_EVENT: ChapterTranslatedEvent = {
  type: "chapter-translated",
  translationId: TRANSLATION_ID,
  chapterStatus: {
    chapterIndex: 2,
    status: "translated",
    completedAt: "2026-04-17T00:00:02.000Z",
  },
  job: {
    id: TRANSLATION_ID,
    status: "IN_PROGRESS",
    completedChapters: 2,
    totalChapters: 3,
    updatedAt: "2026-04-17T00:00:02.000Z",
  },
};

function latestRedisInstance() {
  const instance = redisInstances.at(-1);
  expect(instance).toBeTruthy();
  return instance!;
}

function routeContext(translationId = TRANSLATION_ID) {
  return { params: Promise.resolve({ translationId }) };
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const result = await reader.read();
  expect(result.done).toBe(false);
  expect(result.value).toBeTruthy();
  return textDecoder.decode(result.value);
}

beforeEach(() => {
  vi.clearAllMocks();
  queuedRedisOverrides.length = 0;
  redisInstances.length = 0;
  process.env.UPSTASH_REDIS_URL = "rediss://:pw@host.upstash.io:6379";

  mockGetClientIp.mockReturnValue("127.0.0.1");
  mockCheck.mockReturnValue({
    allowed: true,
    remaining: 29,
    resetAt: Date.now() + 60_000,
  });
  mockRateLimitResponse.mockImplementation((result) =>
    Response.json({ error: "Rate limited", resetAt: result.resetAt }, { status: 429 })
  );

  mockRequireAuth.mockResolvedValue({
    session: SESSION,
    response: null,
  });

  mockGetTranslationJobStatus.mockResolvedValue(SNAPSHOT);
});

describe("GET /api/translation/jobs/[translationId]/stream", () => {
  it("exports the Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
  });

  it("returns a text/event-stream response whose first chunk contains retry and snapshot data", async () => {
    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const firstChunk = await readChunk(reader!);

    expect(firstChunk).toBe(
      `retry: ${TRANSLATION_STREAM_RETRY_MS}\nevent: snapshot\ndata: ${JSON.stringify(SNAPSHOT)}\n\n`
    );
    expect(mockRequireAuth).toHaveBeenCalledOnce();
    expect(mockGetTranslationJobStatus).toHaveBeenCalledWith(TRANSLATION_ID, "user-123");

    await reader!.cancel();
  });

  it("relays chapter-translated messages after the initial snapshot and cleans up on stream cancel", async () => {
    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    expect(await readChunk(reader!)).toContain("event: snapshot");

    const redis = latestRedisInstance();
    (redis.emit as (event: string, ...args: unknown[]) => boolean)(
      "message",
      CHANNEL,
      JSON.stringify(CHAPTER_EVENT)
    );

    expect(await readChunk(reader!)).toBe(
      `event: chapter-translated\ndata: ${JSON.stringify(CHAPTER_EVENT)}\n\n`
    );

    await reader!.cancel();

    expect(redis.unsubscribe).toHaveBeenCalledWith(CHANNEL);
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it("runs subscriber cleanup when the request aborts after the stream has opened", async () => {
    const abortController = new AbortController();
    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream", {
        signal: abortController.signal,
      }),
      routeContext()
    );

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    await readChunk(reader!);

    const redis = latestRedisInstance();
    abortController.abort();

    const finalRead = await reader!.read();
    expect(finalRead.done).toBe(true);
    expect(redis.unsubscribe).toHaveBeenCalledWith(CHANNEL);
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it("treats an unknown IP as a valid limiter key instead of crashing", async () => {
    mockGetClientIp.mockReturnValueOnce("unknown");

    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );

    expect(response.status).toBe(200);
    expect(mockCheck).toHaveBeenCalledWith("unknown");
  });

  it("returns the auth JSON response before opening the stream", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      session: null,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockGetTranslationJobStatus).not.toHaveBeenCalled();
    expect(redisInstances).toHaveLength(0);
  });

  it("returns the limiter JSON response before opening the stream", async () => {
    mockCheck.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });

    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual(
      expect.objectContaining({ error: "Rate limited" })
    );
    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(mockGetTranslationJobStatus).not.toHaveBeenCalled();
    expect(redisInstances).toHaveLength(0);
  });

  it("maps a missing translation job to a 404 JSON response without opening a partial stream", async () => {
    mockGetTranslationJobStatus.mockRejectedValueOnce(
      new TranslationHttpError(404, "Translation job not found.")
    );

    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-missing/stream"),
      routeContext("job-missing")
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Translation job not found." });
    expect(mockHandleTranslationRouteError).toHaveBeenCalledOnce();
    expect(redisInstances).toHaveLength(0);
  });

  it("serializes empty chapter statuses as a valid snapshot event", async () => {
    const emptySnapshot = {
      job: {
        id: "job-empty",
        status: "PENDING",
        completedChapters: 0,
        totalChapters: 0,
        progressPercent: 0,
        downloadUrl: null,
      },
      chapterStatuses: [],
    };
    mockGetTranslationJobStatus.mockResolvedValueOnce(emptySnapshot);

    const response = await GET(
      new Request("http://localhost/api/translation/jobs/job-empty/stream"),
      routeContext("job-empty")
    );

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    const firstChunk = await readChunk(reader!);

    expect(firstChunk).toContain("event: snapshot");
    expect(firstChunk).toContain(`data: ${JSON.stringify(emptySnapshot)}`);
    await reader!.cancel();
  });

  it("returns a fresh snapshot first chunk on reconnect", async () => {
    const firstSnapshot = {
      ...SNAPSHOT,
      job: {
        ...SNAPSHOT.job,
        updatedAt: "2026-04-17T00:00:01.000Z",
      },
    };
    const secondSnapshot = {
      ...SNAPSHOT,
      job: {
        ...SNAPSHOT.job,
        completedChapters: 2,
        progressPercent: 67,
        updatedAt: "2026-04-17T00:00:02.000Z",
      },
    };
    mockGetTranslationJobStatus
      .mockResolvedValueOnce(firstSnapshot)
      .mockResolvedValueOnce(secondSnapshot);

    const firstResponse = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );
    const secondResponse = await GET(
      new Request("http://localhost/api/translation/jobs/job-123/stream"),
      routeContext()
    );

    const firstReader = firstResponse.body?.getReader();
    const secondReader = secondResponse.body?.getReader();
    expect(firstReader).toBeTruthy();
    expect(secondReader).toBeTruthy();

    expect(await readChunk(firstReader!)).toContain(
      `data: ${JSON.stringify(firstSnapshot)}`
    );
    expect(await readChunk(secondReader!)).toContain(
      `data: ${JSON.stringify(secondSnapshot)}`
    );

    await firstReader!.cancel();
    await secondReader!.cancel();
  });
});
