import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { TranslationHttpError } from "@/app/lib/translation/errors";

// ---------------------------------------------------------------------------
// Mocks — vi.mock calls are hoisted before imports by vitest
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.fn();
vi.mock("@/app/lib/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: () => ({ allowed: true }) },
  apiFrequentLimiter: { check: () => ({ allowed: true }) },
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: () =>
    Response.json({ error: "Rate limited" }, { status: 429 }),
}));

const mockEnqueue = vi.fn();
vi.mock("@/app/lib/queue/translation", () => ({
  enqueueTranslationJob: (...args: unknown[]) => mockEnqueue(...args),
}));

const mockCreateJob = vi.fn();
const mockContinueTranslation = vi.fn();
const mockRetryTranslationJob = vi.fn();

vi.mock("@/app/lib/translation/service", () => ({
  createTranslationJobFromNovelDetails: (...args: unknown[]) =>
    mockCreateJob(...args),
  getLatestNovelTranslationJobView: vi.fn().mockResolvedValue(null),
  continueTranslation: (...args: unknown[]) =>
    mockContinueTranslation(...args),
  retryTranslationJob: (...args: unknown[]) =>
    mockRetryTranslationJob(...args),
}));

const mockParsePayload = vi.fn();
vi.mock("@/app/lib/translation/validation", () => ({
  parseStartTranslationPayload: (...args: unknown[]) =>
    mockParsePayload(...args),
}));

// ---------------------------------------------------------------------------
// Route imports — after mocks are wired
// ---------------------------------------------------------------------------

import { POST as startJobsPost } from "@/app/api/translation/novels/[novelId]/jobs/route";
import { POST as continuePost } from "@/app/api/translation/novels/[novelId]/continue/route";
import { POST as retryPost } from "@/app/api/translation/jobs/[translationId]/retry/route";

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const MOCK_SESSION = { user: { id: "user-123" } };

const MOCK_START_JOB = {
  id: "job-start-001",
  status: "PENDING",
  novelId: "novel-001",
};
const MOCK_CONTINUE_JOB = {
  id: "job-continue-001",
  status: "PENDING",
  novelId: "novel-001",
};
const MOCK_RETRY_JOB = {
  id: "job-retry-001",
  status: "PENDING",
  novelId: "novel-001",
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emptyPostRequest(): Request {
  return new Request("http://localhost/api/test", { method: "POST" });
}

function novelContext(novelId = "novel-001") {
  return { params: Promise.resolve({ novelId }) };
}

function translationContext(translationId = "trans-001") {
  return { params: Promise.resolve({ translationId }) };
}

// ---------------------------------------------------------------------------
// Global setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: auth succeeds
  mockRequireAuth.mockResolvedValue({
    session: MOCK_SESSION,
    response: null,
  });

  // Default: service functions succeed
  mockCreateJob.mockResolvedValue(MOCK_START_JOB);
  mockContinueTranslation.mockResolvedValue(MOCK_CONTINUE_JOB);
  mockRetryTranslationJob.mockResolvedValue(MOCK_RETRY_JOB);

  // Default: enqueue succeeds
  mockEnqueue.mockResolvedValue({ jobId: "queued-job-001" });

  // Default: parse payload succeeds
  mockParsePayload.mockReturnValue({ profileId: "prof-001" });
});

// ---------------------------------------------------------------------------
// Start route — POST /api/translation/novels/[novelId]/jobs
// ---------------------------------------------------------------------------

describe("POST /api/translation/novels/[novelId]/jobs (start)", () => {
  it("returns 201 with { job } on success", async () => {
    const res = await startJobsPost(
      jsonRequest({ profileId: "prof-001" }),
      novelContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.job).toEqual(MOCK_START_JOB);
  });

  it("enqueues with allowFailedState: false and correct IDs", async () => {
    await startJobsPost(
      jsonRequest({ profileId: "prof-001" }),
      novelContext(),
    );
    expect(mockEnqueue).toHaveBeenCalledOnce();
    expect(mockEnqueue).toHaveBeenCalledWith({
      translationId: "job-start-001",
      userId: "user-123",
      allowFailedState: false,
    });
  });

  it("returns 500 JSON error when enqueue fails", async () => {
    mockEnqueue.mockRejectedValueOnce(
      new TranslationHttpError(
        500,
        "Failed to enqueue translation job: Redis OOM",
      ),
    );
    const res = await startJobsPost(
      jsonRequest({ profileId: "prof-001" }),
      novelContext(),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/enqueue/i);
  });

  it("returns 401 when auth fails — does not enqueue", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      session: null,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await startJobsPost(
      jsonRequest({ profileId: "prof-001" }),
      novelContext(),
    );
    expect(res.status).toBe(401);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed payload — does not enqueue", async () => {
    mockParsePayload.mockImplementationOnce(() => {
      throw new TranslationHttpError(400, "profileId must be a string.");
    });
    const res = await startJobsPost(jsonRequest({}), novelContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/profileId/);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("returns mapped error when service throws 404", async () => {
    mockCreateJob.mockRejectedValueOnce(
      new TranslationHttpError(404, "Novel not found."),
    );
    const res = await startJobsPost(
      jsonRequest({ profileId: "prof-001" }),
      novelContext(),
    );
    expect(res.status).toBe(404);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Continue route — POST /api/translation/novels/[novelId]/continue
// ---------------------------------------------------------------------------

describe("POST /api/translation/novels/[novelId]/continue", () => {
  it("returns 201 with { job } on success", async () => {
    const res = await continuePost(emptyPostRequest(), novelContext());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.job).toEqual(MOCK_CONTINUE_JOB);
  });

  it("enqueues with allowFailedState: false and correct IDs", async () => {
    await continuePost(emptyPostRequest(), novelContext());
    expect(mockEnqueue).toHaveBeenCalledOnce();
    expect(mockEnqueue).toHaveBeenCalledWith({
      translationId: "job-continue-001",
      userId: "user-123",
      allowFailedState: false,
    });
  });

  it("returns 500 JSON error when enqueue fails", async () => {
    mockEnqueue.mockRejectedValueOnce(
      new TranslationHttpError(
        500,
        "Failed to enqueue translation job: timeout",
      ),
    );
    const res = await continuePost(emptyPostRequest(), novelContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/enqueue/i);
  });

  it("returns mapped error when service throws 409", async () => {
    mockContinueTranslation.mockRejectedValueOnce(
      new TranslationHttpError(409, "All chapters are already translated."),
    );
    const res = await continuePost(emptyPostRequest(), novelContext());
    expect(res.status).toBe(409);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Retry route — POST /api/translation/jobs/[translationId]/retry
// ---------------------------------------------------------------------------

describe("POST /api/translation/jobs/[translationId]/retry", () => {
  it("returns 200 with { job } on success", async () => {
    const res = await retryPost(emptyPostRequest(), translationContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toEqual(MOCK_RETRY_JOB);
  });

  it("enqueues with allowFailedState: true and correct IDs", async () => {
    await retryPost(emptyPostRequest(), translationContext());
    expect(mockEnqueue).toHaveBeenCalledOnce();
    expect(mockEnqueue).toHaveBeenCalledWith({
      translationId: "job-retry-001",
      userId: "user-123",
      allowFailedState: true,
    });
  });

  it("returns 500 JSON error when enqueue fails", async () => {
    mockEnqueue.mockRejectedValueOnce(
      new TranslationHttpError(
        500,
        "Translation queue is not reachable: ECONNREFUSED",
      ),
    );
    const res = await retryPost(emptyPostRequest(), translationContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/queue|reachable/i);
  });

  it("returns mapped error when service throws 404", async () => {
    mockRetryTranslationJob.mockRejectedValueOnce(
      new TranslationHttpError(404, "Translation job not found."),
    );
    const res = await retryPost(emptyPostRequest(), translationContext());
    expect(res.status).toBe(404);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: no after() usage in any producer route
// ---------------------------------------------------------------------------

describe("no after() usage in producer routes", () => {
  const ROUTE_FILES = [
    "app/api/translation/novels/[novelId]/jobs/route.ts",
    "app/api/translation/novels/[novelId]/continue/route.ts",
    "app/api/translation/jobs/[translationId]/retry/route.ts",
  ];

  for (const file of ROUTE_FILES) {
    it(`${file} does not contain after(`, () => {
      const fullPath = path.resolve(process.cwd(), file);
      const content = readFileSync(fullPath, "utf8");
      expect(content).not.toMatch(/\bafter\s*\(/);
    });
  }
});
