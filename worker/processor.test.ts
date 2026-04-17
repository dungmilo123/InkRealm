import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { TranslationQueueJobData } from "@/app/lib/queue/translation";

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("@/app/lib/translation/service", () => ({
  runTranslationJob: vi.fn(),
}));

vi.mock("@/app/lib/translation/data", () => ({
  getTranslationJobById: vi.fn(),
  setTranslationFailed: vi.fn(),
}));

import { processTranslationJob, handleTerminalFailure } from "./processor";
import { runTranslationJob } from "@/app/lib/translation/service";
import {
  getTranslationJobById,
  setTranslationFailed,
} from "@/app/lib/translation/data";

// ── Helpers ────────────────────────────────────────────────────────────

type TranslationRecord = NonNullable<
  Awaited<ReturnType<typeof getTranslationJobById>>
>;

/** Minimal fake BullMQ Job object — only the fields the processor uses. */
function fakeJob(data: TranslationQueueJobData): Job<TranslationQueueJobData> {
  return { data } as unknown as Job<TranslationQueueJobData>;
}

function fakeTranslation(
  overrides: Partial<TranslationRecord> = {},
): TranslationRecord {
  return {
    id: "trans-1",
    status: "IN_PROGRESS",
    failedChapterIndex: null,
    failureReason: null,
    ...overrides,
  } as TranslationRecord;
}

// ── Tests ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("processTranslationJob", () => {
  it("forwards all TranslationQueueJobData fields to runTranslationJob", async () => {
    const data: TranslationQueueJobData = {
      translationId: "t-123",
      userId: "u-456",
      profileId: "p-789",
      allowFailedState: true,
    };
    vi.mocked(runTranslationJob).mockResolvedValue(
      {} as Awaited<ReturnType<typeof runTranslationJob>>,
    );

    await processTranslationJob(fakeJob(data));

    expect(runTranslationJob).toHaveBeenCalledWith({
      translationId: "t-123",
      userId: "u-456",
      profileId: "p-789",
      allowFailedState: true,
    });
  });

  it("forwards correctly when optional fields are omitted", async () => {
    const data: TranslationQueueJobData = {
      translationId: "t-123",
      userId: "u-456",
    };
    vi.mocked(runTranslationJob).mockResolvedValue(
      {} as Awaited<ReturnType<typeof runTranslationJob>>,
    );

    await processTranslationJob(fakeJob(data));

    expect(runTranslationJob).toHaveBeenCalledWith({
      translationId: "t-123",
      userId: "u-456",
      profileId: undefined,
      allowFailedState: undefined,
    });
  });

  it("lets exceptions bubble for BullMQ retry", async () => {
    vi.mocked(runTranslationJob).mockRejectedValue(
      new Error("Translation API timeout"),
    );

    await expect(
      processTranslationJob(
        fakeJob({ translationId: "t-1", userId: "u-1" }),
      ),
    ).rejects.toThrow("Translation API timeout");
  });
});

describe("handleTerminalFailure", () => {
  const baseData: TranslationQueueJobData = {
    translationId: "trans-1",
    userId: "u-1",
  };

  it("marks translation FAILED in DB when status is IN_PROGRESS", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({ status: "IN_PROGRESS" }),
    );
    vi.mocked(setTranslationFailed).mockResolvedValue(
      {} as Awaited<ReturnType<typeof setTranslationFailed>>,
    );

    await handleTerminalFailure(fakeJob(baseData), new Error("out of tokens"));

    expect(setTranslationFailed).toHaveBeenCalledWith({
      translationId: "trans-1",
      failedChapterIndex: 1,
      failureReason: "out of tokens",
    });
  });

  it("preserves existing failedChapterIndex from partial runs", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({
        status: "IN_PROGRESS",
        failedChapterIndex: 7,
      }),
    );
    vi.mocked(setTranslationFailed).mockResolvedValue(
      {} as Awaited<ReturnType<typeof setTranslationFailed>>,
    );

    await handleTerminalFailure(
      fakeJob(baseData),
      new Error("rate limit exceeded"),
    );

    expect(setTranslationFailed).toHaveBeenCalledWith(
      expect.objectContaining({ failedChapterIndex: 7 }),
    );
  });

  it("skips FAILED write when DB status is CANCELLED", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({ status: "CANCELLED" }),
    );

    await handleTerminalFailure(fakeJob(baseData), new Error("boom"));

    expect(setTranslationFailed).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("skipping terminal write"),
    );
  });

  it("skips FAILED write when DB status is COMPLETED", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({ status: "COMPLETED" }),
    );

    await handleTerminalFailure(fakeJob(baseData), new Error("boom"));

    expect(setTranslationFailed).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("skipping terminal write"),
    );
  });

  it("does not throw when translation not found in DB", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(null);

    await expect(
      handleTerminalFailure(fakeJob(baseData), new Error("gone")),
    ).resolves.toBeUndefined();

    expect(setTranslationFailed).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("translation not found"),
    );
  });

  it("does not throw when DB read fails", async () => {
    vi.mocked(getTranslationJobById).mockRejectedValue(
      new Error("connection reset"),
    );

    await expect(
      handleTerminalFailure(fakeJob(baseData), new Error("orig")),
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("DB error in terminal-failure handler"),
      expect.any(String),
    );
  });

  it("does not throw when DB write (setTranslationFailed) fails", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({ status: "IN_PROGRESS" }),
    );
    vi.mocked(setTranslationFailed).mockRejectedValue(
      new Error("write timeout"),
    );

    await expect(
      handleTerminalFailure(fakeJob(baseData), new Error("orig")),
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("DB error in terminal-failure handler"),
      expect.any(String),
    );
  });

  it("truncates long error messages to 1000 chars", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({ status: "IN_PROGRESS" }),
    );
    vi.mocked(setTranslationFailed).mockResolvedValue(
      {} as Awaited<ReturnType<typeof setTranslationFailed>>,
    );

    const longMessage = "x".repeat(2000);
    await handleTerminalFailure(fakeJob(baseData), new Error(longMessage));

    const firstCall = vi.mocked(setTranslationFailed).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected setTranslationFailed to be called");
    }
    const call = firstCall[0];
    expect(call.failureReason).toHaveLength(1000);
  });

  it("defaults failedChapterIndex to 1 when translation has null value", async () => {
    vi.mocked(getTranslationJobById).mockResolvedValue(
      fakeTranslation({
        status: "PENDING",
        failedChapterIndex: null,
      }),
    );
    vi.mocked(setTranslationFailed).mockResolvedValue(
      {} as Awaited<ReturnType<typeof setTranslationFailed>>,
    );

    await handleTerminalFailure(fakeJob(baseData), new Error("fail"));

    expect(setTranslationFailed).toHaveBeenCalledWith(
      expect.objectContaining({ failedChapterIndex: 1 }),
    );
  });
});
