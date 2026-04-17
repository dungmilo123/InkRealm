import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock ioredis BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockPublish = vi.fn().mockResolvedValue(1); // 1 subscriber
const mockRedisCtor = vi.fn();

const mockRedisInstance = {
  publish: mockPublish,
};

vi.mock("ioredis", () => {
  // Must use a regular function so `new IORedis(...)` works
  function IORedis() {
    mockRedisCtor();
    return mockRedisInstance;
  }
  return { default: IORedis };
});

// ---------------------------------------------------------------------------
// Module under test — imported after mocks
// ---------------------------------------------------------------------------

import {
  getTranslationChannel,
  publishChapterTranslated,
  type ChapterTranslatedEvent,
} from "./pubsub";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEvent(): ChapterTranslatedEvent {
  return {
    type: "chapter-translated",
    translationId: "txn-001",
    chapterStatus: {
      chapterIndex: 3,
      status: "translated",
      completedAt: "2026-04-17T07:00:00.000Z",
    },
    job: {
      id: "txn-001",
      status: "IN_PROGRESS",
      completedChapters: 4,
      totalChapters: 10,
      updatedAt: "2026-04-17T07:00:00.000Z",
    },
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("getTranslationChannel", () => {
  it("returns translation:{id} for a given translationId", () => {
    expect(getTranslationChannel("abc-123")).toBe("translation:abc-123");
  });

  it("handles empty string", () => {
    expect(getTranslationChannel("")).toBe("translation:");
  });
});

describe("publishChapterTranslated", () => {
  const originalEnv = process.env.UPSTASH_REDIS_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset singleton between tests
    const g = globalThis as Record<string, unknown>;
    delete g.__translationPublisher;

    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.UPSTASH_REDIS_URL = "rediss://:pw@host.upstash.io:6379";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.UPSTASH_REDIS_URL;
    } else {
      process.env.UPSTASH_REDIS_URL = originalEnv;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  // ── Happy path ─────────────────────────────────────────────────────────

  it("calls redis.publish with correct channel and JSON payload", async () => {
    const event = validEvent();
    await publishChapterTranslated(event);

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const [channel, payload] = mockPublish.mock.calls[0];
    expect(channel).toBe("translation:txn-001");
    expect(JSON.parse(payload)).toEqual(event);
  });

  it("logs successful publish with translationId and chapterIndex", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const event = validEvent();
    await publishChapterTranslated(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("translation:txn-001"),
    );
    const logMsg = consoleSpy.mock.calls[0][0] as string;
    expect(logMsg).toContain("chapterIndex=3");
    consoleSpy.mockRestore();
  });

  // ── Payload shape ──────────────────────────────────────────────────────

  it("payload matches ChapterTranslatedEvent type (all required fields)", async () => {
    const event = validEvent();
    await publishChapterTranslated(event);

    const payload = JSON.parse(mockPublish.mock.calls[0][1]) as ChapterTranslatedEvent;
    expect(payload.type).toBe("chapter-translated");
    expect(payload.translationId).toBe("txn-001");
    expect(payload.chapterStatus).toEqual({
      chapterIndex: 3,
      status: "translated",
      completedAt: "2026-04-17T07:00:00.000Z",
    });
    expect(payload.job).toEqual({
      id: "txn-001",
      status: "IN_PROGRESS",
      completedChapters: 4,
      totalChapters: 10,
      updatedAt: "2026-04-17T07:00:00.000Z",
    });
  });

  // ── Error isolation (R031) ─────────────────────────────────────────────

  it("does NOT throw when publish rejects — logs error instead", async () => {
    mockPublish.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Must not throw
    await expect(publishChapterTranslated(validEvent())).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("translationId=txn-001"),
      expect.stringContaining("ECONNREFUSED") as unknown as string,
    );
    errorSpy.mockRestore();
  });

  it("logs error with translationId and chapterIndex on publish failure", async () => {
    mockPublish.mockRejectedValueOnce(new Error("timeout"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await publishChapterTranslated(validEvent());

    const logMessage = errorSpy.mock.calls[0][0] as string;
    expect(logMessage).toContain("translationId=txn-001");
    expect(logMessage).toContain("chapterIndex=3");
    errorSpy.mockRestore();
  });

  // ── Env validation ─────────────────────────────────────────────────────

  it("logs error and returns (not throws) when UPSTASH_REDIS_URL is missing", async () => {
    delete process.env.UPSTASH_REDIS_URL;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(publishChapterTranslated(validEvent())).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("translationId=txn-001"),
      expect.stringContaining("missing UPSTASH_REDIS_URL") as unknown as string,
    );
    errorSpy.mockRestore();
  });

  it("logs error and returns when UPSTASH_REDIS_URL has invalid scheme", async () => {
    process.env.UPSTASH_REDIS_URL = "http://invalid";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(publishChapterTranslated(validEvent())).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("translationId=txn-001"),
      expect.stringContaining("must start with redis://") as unknown as string,
    );
    errorSpy.mockRestore();
  });

  // ── Singleton reuse ────────────────────────────────────────────────────

  it("reuses the same ioredis instance across calls in dev mode", async () => {
    await publishChapterTranslated(validEvent());
    await publishChapterTranslated(validEvent());

    // publish called twice but constructor called once (singleton reused)
    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);
    // The globalThis singleton should exist
    const g = globalThis as Record<string, unknown>;
    expect(g.__translationPublisher).toBeDefined();
  });

  it("reuses the same ioredis instance across calls in production mode", async () => {
    process.env.NODE_ENV = "production";

    await publishChapterTranslated(validEvent());
    await publishChapterTranslated(validEvent());

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);

    const g = globalThis as Record<string, unknown>;
    expect(g.__translationPublisher).toBeDefined();
  });
});
