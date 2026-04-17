import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

type WorkerProcessor = (job: unknown) => Promise<void> | void;

// ── Hoisted state (available inside vi.mock factories) ─────────────────

const {
  mockWorkerOn,
  mockWorkerClose,
  mockWorkerConstructorCalls,
  mockServerListen,
  mockServerClose,
} = vi.hoisted(() => ({
  mockWorkerOn: vi.fn(),
  mockWorkerClose: vi.fn().mockResolvedValue(undefined),
  mockWorkerConstructorCalls: [] as Array<{
    queueName: string;
    processor: WorkerProcessor;
    opts: Record<string, unknown>;
  }>,
  mockServerListen: vi.fn((port: number, cb?: () => void) => {
    void port;
    if (cb) cb();
  }),
  mockServerClose: vi.fn(),
}));

// ── Mocks (declared before imports — hoisted by Vitest) ────────────────

// Mock @next/env — loadEnvConfig populates process.env before module code runs
vi.mock("@next/env", () => ({
  loadEnvConfig: vi.fn(() => {
    process.env.UPSTASH_REDIS_URL = "redis://fake:6379";
    process.env.PORT = "4444";
  }),
}));

// BullMQ Worker — class constructor
vi.mock("bullmq", () => {
  class MockWorker {
    on = mockWorkerOn;
    close = mockWorkerClose;

    constructor(
      queueName: string,
      processor: WorkerProcessor,
      opts: Record<string, unknown>,
    ) {
      mockWorkerConstructorCalls.push({ queueName, processor, opts });
    }
  }

  return { Worker: MockWorker };
});

// ioredis constructor
vi.mock("ioredis", () => {
  class MockIORedis {}
  return { default: MockIORedis };
});

// Processor module
vi.mock("./processor", () => ({
  processTranslationJob: vi.fn(),
  handleTerminalFailure: vi.fn(),
}));

// Queue constants
vi.mock("@/app/lib/queue/translation", () => ({
  TRANSLATION_QUEUE_NAME: "translation",
}));

// node:http — prevent real port binding
vi.mock("node:http", () => ({
  createServer: vi.fn(
    (
      handler: (
        req: IncomingMessage,
        res: ServerResponse,
      ) => void,
    ) => {
      void handler;
      return {
        listen: mockServerListen,
        close: mockServerClose,
      };
    },
  ),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import { handleHealthRequest } from "./index";
import { TRANSLATION_QUEUE_NAME } from "@/app/lib/queue/translation";
import { handleTerminalFailure } from "./processor";

// ── Helpers ────────────────────────────────────────────────────────────

function fakeHttp(method: string, url: string) {
  const req = { method, url } as IncomingMessage;

  let writtenStatus = 0;
  let writtenHeaders: Record<string, string> = {};
  let writtenBody = "";

  const res = {
    writeHead(status: number, headers?: Record<string, string>) {
      writtenStatus = status;
      if (headers) writtenHeaders = headers;
      return res;
    },
    end(body?: string) {
      if (body) writtenBody = body;
      return res;
    },
  } as unknown as ServerResponse;

  return {
    req,
    res,
    getStatus: () => writtenStatus,
    getHeaders: () => writtenHeaders,
    getBody: () => writtenBody,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // Only clear processor mocks between tests — mockWorkerOn calls are from
  // module init and must persist across tests.
  vi.mocked(handleTerminalFailure).mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Health handler", () => {
  it("returns 200 with JSON body for GET /health", () => {
    const { req, res, getStatus, getHeaders, getBody } = fakeHttp(
      "GET",
      "/health",
    );

    handleHealthRequest(req, res);

    expect(getStatus()).toBe(200);
    expect(getHeaders()["Content-Type"]).toBe("application/json");
    expect(JSON.parse(getBody())).toEqual({ status: "ok" });
  });

  it("returns 404 for non-/health paths", () => {
    const { req, res, getStatus, getBody } = fakeHttp("GET", "/ready");

    handleHealthRequest(req, res);

    expect(getStatus()).toBe(404);
    expect(getBody()).toBe("");
  });
});

describe("Worker wiring", () => {
  it("Worker script exists in package.json", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf-8"),
    );
    expect(pkg.scripts.worker).toBe("tsx worker/index.ts");
  });

  it("Worker creation uses correct queue name", () => {
    expect(mockWorkerConstructorCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockWorkerConstructorCalls[0].queueName).toBe(
      TRANSLATION_QUEUE_NAME,
    );
  });

  it("Worker uses concurrency 1", () => {
    expect(mockWorkerConstructorCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockWorkerConstructorCalls[0].opts).toMatchObject({
      concurrency: 1,
    });
  });
});

describe("Terminal failure event routing", () => {
  it("fires handleTerminalFailure on final attempt", () => {
    const failedCall = mockWorkerOn.mock.calls.find(
      (c: unknown[]) => c[0] === "failed",
    );
    expect(failedCall).toBeDefined();

    const failedHandler = failedCall?.[1];
    expect(typeof failedHandler).toBe("function");
    if (typeof failedHandler !== "function") {
      throw new Error("Expected failed handler function");
    }

    const fakeJob = {
      id: "job-1",
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: { translationId: "t-1", userId: "u-1" },
    };
    const error = new Error("exhausted");

    failedHandler(fakeJob, error);

    expect(handleTerminalFailure).toHaveBeenCalledWith(fakeJob, error);
  });

  it("skips handleTerminalFailure on non-final attempt", () => {
    const failedCall = mockWorkerOn.mock.calls.find(
      (c: unknown[]) => c[0] === "failed",
    );
    expect(failedCall).toBeDefined();

    const failedHandler = failedCall?.[1];
    expect(typeof failedHandler).toBe("function");
    if (typeof failedHandler !== "function") {
      throw new Error("Expected failed handler function");
    }

    const fakeJob = {
      id: "job-2",
      attemptsMade: 1,
      opts: { attempts: 3 },
      data: { translationId: "t-2", userId: "u-2" },
    };
    const error = new Error("retrying");

    failedHandler(fakeJob, error);

    expect(handleTerminalFailure).not.toHaveBeenCalled();
  });
});
