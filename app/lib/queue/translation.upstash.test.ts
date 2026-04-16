import { describe, it, expect, afterAll } from "vitest";
import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Env-gated smoke test — only runs when UPSTASH_REDIS_URL is set.
 * Verifies the real Upstash Redis connection + BullMQ round-trip:
 * enqueue a job, read it back by jobId, then clean up.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_URL;
const TEST_QUEUE_NAME = "translation-smoke-test";

// Unique ID per test run to avoid collisions
const uniqueJobId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!UPSTASH_URL)("Upstash BullMQ smoke test", () => {
  let connection: IORedis;
  let queue: Queue;

  // Setup: create a dedicated queue with a real Upstash connection
  beforeAll(() => {
    connection = new IORedis(UPSTASH_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    queue = new Queue(TEST_QUEUE_NAME, {
      connection: connection as never,
    });
  });

  afterAll(async () => {
    // Clean up: remove the test job and close connections
    try {
      const job = await queue.getJob(uniqueJobId);
      if (job) await job.remove();
    } catch {
      // best-effort cleanup
    }
    try {
      await queue.obliterate({ force: true });
    } catch {
      // best-effort cleanup
    }
    await queue.close();
    await connection.quit();
  });

  it("enqueues a job and reads it back by jobId", async () => {
    await queue.waitUntilReady();

    const payload = {
      translationId: uniqueJobId,
      userId: "smoke-test-user",
      profileId: "smoke-test-profile",
    };

    const job = await queue.add("translate-novel", payload, {
      jobId: uniqueJobId,
    });

    expect(job.id).toBe(uniqueJobId);

    // Read back by jobId
    const retrieved = await queue.getJob(uniqueJobId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.data).toMatchObject({
      translationId: uniqueJobId,
      userId: "smoke-test-user",
    });
  }, 15_000); // generous timeout for network round-trip

  it("confirms the job is in 'waiting' state", async () => {
    const job = await queue.getJob(uniqueJobId);
    expect(job).toBeDefined();
    const state = await job!.getState();
    expect(state).toBe("waiting");
  }, 10_000);
});
