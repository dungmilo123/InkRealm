import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock ioredis and bullmq BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockRedisInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

vi.mock("ioredis", () => {
  // Must use a regular function (not arrow) so `new IORedis(...)` works
  function IORedis() {
    return mockRedisInstance;
  }
  return { default: IORedis };
});

const mockJob = { id: "test-translation-id" };
const mockQueueAdd = vi.fn().mockResolvedValue(mockJob);
const mockWaitUntilReady = vi.fn().mockResolvedValue(undefined);

let queueConstructorCallCount = 0;

vi.mock("bullmq", () => {
  // Must use a regular function so `new Queue(...)` works
  function Queue() {
    queueConstructorCallCount++;
    return {
      add: mockQueueAdd,
      waitUntilReady: mockWaitUntilReady,
    };
  }
  return { Queue };
});

// ---------------------------------------------------------------------------
// The module under test — imported after mocks are wired
// ---------------------------------------------------------------------------

import {
  TRANSLATION_QUEUE_NAME,
  TRANSLATION_QUEUE_JOB_NAME,
  enqueueTranslationJob,
} from "./translation";
import type { TranslationQueueJobData } from "./translation";
import { TranslationHttpError } from "@/app/lib/translation/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload(): TranslationQueueJobData {
  return {
    translationId: "txn-001",
    userId: "usr-001",
    profileId: "prof-001",
    allowFailedState: false,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("translation queue constants", () => {
  it("exports expected queue name", () => {
    expect(TRANSLATION_QUEUE_NAME).toBe("translation");
  });

  it("exports expected job name", () => {
    expect(TRANSLATION_QUEUE_JOB_NAME).toBe("translate-novel");
  });
});

describe("enqueueTranslationJob", () => {
  const originalEnv = process.env.UPSTASH_REDIS_URL;

  beforeEach(() => {
    // Reset singleton cache between tests
    const g = globalThis as Record<string, unknown>;
    delete g.__translationRedis;
    delete g.__translationQueue;

    vi.clearAllMocks();
    queueConstructorCallCount = 0;
    process.env.UPSTASH_REDIS_URL = "rediss://:pw@host.upstash.io:6379";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.UPSTASH_REDIS_URL;
    } else {
      process.env.UPSTASH_REDIS_URL = originalEnv;
    }
  });

  // ── Config validation ──────────────────────────────────────────────────

  it("throws TranslationHttpError when UPSTASH_REDIS_URL is missing", async () => {
    delete process.env.UPSTASH_REDIS_URL;
    await expect(enqueueTranslationJob(validPayload())).rejects.toThrow(
      TranslationHttpError,
    );
    await expect(enqueueTranslationJob(validPayload())).rejects.toThrow(
      /missing UPSTASH_REDIS_URL/,
    );
  });

  it("throws TranslationHttpError when UPSTASH_REDIS_URL has invalid scheme", async () => {
    process.env.UPSTASH_REDIS_URL = "http://invalid";
    await expect(enqueueTranslationJob(validPayload())).rejects.toThrow(
      /must start with redis:\/\/ or rediss:\/\//,
    );
  });

  it("accepts redis:// scheme", async () => {
    process.env.UPSTASH_REDIS_URL = "redis://localhost:6379";
    const result = await enqueueTranslationJob(validPayload());
    expect(result.jobId).toBe("test-translation-id");
  });

  // ── Payload validation ─────────────────────────────────────────────────

  it("throws when translationId is missing", async () => {
    await expect(
      enqueueTranslationJob({ translationId: "", userId: "u" }),
    ).rejects.toThrow(/Missing translationId/);
  });

  it("throws when userId is missing", async () => {
    await expect(
      enqueueTranslationJob({ translationId: "t", userId: "" }),
    ).rejects.toThrow(/Missing userId/);
  });

  // ── Singleton reuse ────────────────────────────────────────────────────

  it("reuses the same Queue instance across calls (dev mode)", async () => {
    queueConstructorCallCount = 0;
    await enqueueTranslationJob(validPayload());
    await enqueueTranslationJob(validPayload());
    // Queue constructor called once on first call, not again on second
    expect(queueConstructorCallCount).toBe(1);
  });

  // ── Readiness gating ──────────────────────────────────────────────────

  it("calls waitUntilReady before add", async () => {
    const callOrder: string[] = [];
    mockWaitUntilReady.mockImplementation(() => {
      callOrder.push("ready");
      return Promise.resolve();
    });
    mockQueueAdd.mockImplementation(() => {
      callOrder.push("add");
      return Promise.resolve(mockJob);
    });

    await enqueueTranslationJob(validPayload());
    expect(callOrder).toEqual(["ready", "add"]);
  });

  it("throws TranslationHttpError when waitUntilReady rejects", async () => {
    mockWaitUntilReady.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(enqueueTranslationJob(validPayload())).rejects.toThrow(
      /not reachable/,
    );
  });

  // ── BullMQ add options ─────────────────────────────────────────────────

  it("passes correct job name, data, and options to queue.add", async () => {
    const payload = validPayload();
    await enqueueTranslationJob(payload);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOpts] = mockQueueAdd.mock.calls[0];

    expect(jobName).toBe(TRANSLATION_QUEUE_JOB_NAME);
    expect(jobData).toEqual(payload);
    expect(jobOpts).toMatchObject({
      jobId: payload.translationId,
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
    });
  });

  it("returns jobId from the created job", async () => {
    const result = await enqueueTranslationJob(validPayload());
    expect(result.jobId).toBe("test-translation-id");
  });

  // ── queue.add failure ──────────────────────────────────────────────────

  it("wraps queue.add errors in TranslationHttpError", async () => {
    mockQueueAdd.mockRejectedValueOnce(new Error("Redis OOM"));
    await expect(enqueueTranslationJob(validPayload())).rejects.toThrow(
      TranslationHttpError,
    );
    await expect(
      enqueueTranslationJob(validPayload()),
    ).resolves.toBeDefined(); // second call succeeds (mock resets)
  });

  // ── Payload passthrough ────────────────────────────────────────────────

  it("passes allowFailedState through to the job data", async () => {
    const payload: TranslationQueueJobData = {
      translationId: "txn-002",
      userId: "usr-002",
      allowFailedState: true,
    };
    await enqueueTranslationJob(payload);
    expect(mockQueueAdd.mock.calls[0][1]).toMatchObject({
      allowFailedState: true,
    });
  });
});
