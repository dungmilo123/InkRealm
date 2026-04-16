// ---------------------------------------------------------------------------
// Worker entry point — runs outside Next.js via `npm run worker` / `tsx worker/index.ts`
// ---------------------------------------------------------------------------

// Step 1: Load .env files BEFORE any app module imports.
// @next/env reads .env, .env.local, etc. the same way Next.js does at build time.
// All app modules below rely on process.env being populated.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Step 2: App + library imports (process.env is now populated)
import { Worker } from "bullmq";
import IORedis from "ioredis";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { TRANSLATION_QUEUE_NAME } from "@/app/lib/queue/translation";
import {
  processTranslationJob,
  handleTerminalFailure,
} from "./processor";

// ---------------------------------------------------------------------------
// Validate required environment
// ---------------------------------------------------------------------------

const redisUrl = process.env.UPSTASH_REDIS_URL;
if (!redisUrl) {
  console.error(
    "[worker] UPSTASH_REDIS_URL is not set — cannot start worker",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Redis connection (dedicated instance for BullMQ worker)
// ---------------------------------------------------------------------------

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // required for BullMQ worker blocking operations
});

// ---------------------------------------------------------------------------
// BullMQ Worker
// ---------------------------------------------------------------------------

const worker = new Worker(
  TRANSLATION_QUEUE_NAME,
  async (job) => {
    await processTranslationJob(job);
  },
  { connection, concurrency: 1 },
);

worker.on("active", (job) => {
  console.log(`[worker] Job active: ${job.id}`);
});

worker.on("completed", (job) => {
  console.log(`[worker] Job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.log(`[worker] Job failed: ${job?.id} — ${error.message}`);

  // Only handle terminal failures (all retries exhausted)
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 1)) {
    handleTerminalFailure(job, error);
  }
});

// ---------------------------------------------------------------------------
// Health endpoint (for Railway health checks)
// ---------------------------------------------------------------------------

/** Exported for unit testing. */
export function handleHealthRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end();
  }
}

const port = Number(process.env.PORT) || 3001;
const server = createServer(handleHealthRequest);

server.listen(port, () => {
  console.log(
    `[worker] Translation worker started — queue=${TRANSLATION_QUEUE_NAME} port=${port}`,
  );
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Shutting down... (${signal})`);
  await worker.close();
  server.close();
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
