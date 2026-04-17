/**
 * Tests that runTranslationJob correctly wires publishChapterTranslated
 * after each chapter translation, and that publish failures never break
 * the translation loop (R028 + R031).
 */
import { TranslationStatus } from "@/app/generated/prisma/client";

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────
const {
  mockPublishChapterTranslated,
  mockGetTranslationJobForRunner,
  mockGetTranslationJobById,
  mockSetTranslationInProgress,
  mockListPendingChaptersForRun,
  mockMarkChapterTranslating,
  mockMarkChapterTranslated,
  mockMarkChapterFailed,
  mockUpsertNovelTranslatedChapter,
  mockUpdateChapterSummary,
  mockCountTranslatedChapters,
  mockUpdateTranslationCompletedCount,
  mockSetTranslationCompleted,
  mockSetTranslationFailed,
  mockListTranslatedChaptersForExport,
  mockTranslateChapter,
} = vi.hoisted(() => ({
  mockPublishChapterTranslated: vi.fn(),
  mockGetTranslationJobForRunner: vi.fn(),
  mockGetTranslationJobById: vi.fn(),
  mockSetTranslationInProgress: vi.fn(),
  mockListPendingChaptersForRun: vi.fn(),
  mockMarkChapterTranslating: vi.fn(),
  mockMarkChapterTranslated: vi.fn(),
  mockMarkChapterFailed: vi.fn(),
  mockUpsertNovelTranslatedChapter: vi.fn(),
  mockUpdateChapterSummary: vi.fn(),
  mockCountTranslatedChapters: vi.fn(),
  mockUpdateTranslationCompletedCount: vi.fn(),
  mockSetTranslationCompleted: vi.fn(),
  mockSetTranslationFailed: vi.fn(),
  mockListTranslatedChaptersForExport: vi.fn(),
  mockTranslateChapter: vi.fn(),
}));

// ── Mock: pubsub ────────────────────────────────────────────────────
vi.mock("@/app/lib/translation/pubsub", () => ({
  publishChapterTranslated: mockPublishChapterTranslated,
}));

// ── Mock: data layer ────────────────────────────────────────────────
vi.mock("@/app/lib/translation/data", () => ({
  getTranslationJobForRunner: mockGetTranslationJobForRunner,
  getTranslationJobById: mockGetTranslationJobById,
  setTranslationInProgress: mockSetTranslationInProgress,
  listPendingChaptersForRun: mockListPendingChaptersForRun,
  markChapterTranslating: mockMarkChapterTranslating,
  markChapterTranslated: mockMarkChapterTranslated,
  markChapterFailed: mockMarkChapterFailed,
  upsertNovelTranslatedChapter: mockUpsertNovelTranslatedChapter,
  updateChapterSummary: mockUpdateChapterSummary,
  countTranslatedChapters: mockCountTranslatedChapters,
  updateTranslationCompletedCount: mockUpdateTranslationCompletedCount,
  setTranslationCompleted: mockSetTranslationCompleted,
  setTranslationFailed: mockSetTranslationFailed,
  listTranslatedChaptersForExport: mockListTranslatedChaptersForExport,
  // Stubs that are called but not under test
  countNovelTranslatedChapters: vi.fn().mockResolvedValue(0),
  listPreviousTranslatedChapters: vi.fn().mockResolvedValue([]),
  getChapterTranslationStatuses: vi.fn().mockResolvedValue([]),
  listTranslationJobsForNovel: vi.fn().mockResolvedValue([]),
  createTranslationJobRecord: vi.fn(),
  getLatestTranslationJobForNovel: vi.fn(),
  getTranslationJobWithOwnershipAndStatuses: vi.fn(),
  listUntranslatedChapterIndices: vi.fn(),
  listNovelTranslatedChapters: vi.fn(),
  getNovelTranslatedChapter: vi.fn(),
  prepareTranslationRetry: vi.fn(),
  setTranslationCancelled: vi.fn(),
}));

// ── Mock: adapters ──────────────────────────────────────────────────
vi.mock("@/app/lib/translation/adapters", () => ({
  getTranslationAdapter: () => ({
    translateChapter: mockTranslateChapter,
  }),
}));

// ── Mock: reader ────────────────────────────────────────────────────
vi.mock("@/app/lib/reader", () => ({
  getReaderDocument: vi.fn().mockResolvedValue({
    chapterCount: 2,
    chapters: [
      { index: 1, title: "Chapter 1", paragraphs: ["Paragraph 1"] },
      { index: 2, title: "Chapter 2", paragraphs: ["Paragraph 2"] },
    ],
  }),
  ReaderUnavailableError: class extends Error {},
}));

// ── Mock: profiles ──────────────────────────────────────────────────
vi.mock("@/app/lib/translation/profiles", () => ({
  getTranslationProfileCredential: vi.fn().mockResolvedValue({
    provider: "OPENAI",
    model: "gpt-4",
    apiKey: "test-key",
    baseUrl: null,
    customPrompt: null,
  }),
  getCredentialForTranslationSnapshot: vi.fn().mockResolvedValue({
    provider: "OPENAI",
    model: "gpt-4",
    apiKey: "test-key",
    baseUrl: null,
    customPrompt: null,
  }),
}));

// ── Mock: novels ────────────────────────────────────────────────────
vi.mock("@/app/lib/novels", () => ({
  getNovelById: vi.fn().mockResolvedValue({
    id: "novel-1",
    userId: "user-1",
    title: "Test Novel",
  }),
  cachedGetNovelById: vi.fn().mockResolvedValue({
    id: "novel-1",
    userId: "user-1",
    title: "Test Novel",
  }),
}));

// ── Mock: glossary ──────────────────────────────────────────────────
vi.mock("@/app/lib/translation/glossary", () => ({
  listGlossaryEntriesForTranslation: vi.fn().mockResolvedValue([]),
  createPendingGlossaryEntries: vi.fn().mockResolvedValue([]),
}));

// ── Mock: export ────────────────────────────────────────────────────
vi.mock("@/app/lib/translation/export", () => ({
  writeTranslatedExportFile: vi.fn().mockResolvedValue({ fileName: "f.txt", filePath: "/tmp/f.txt" }),
  canDownloadTranslationExport: vi.fn().mockReturnValue(false),
}));

// ── Mock: epub-export ───────────────────────────────────────────────
vi.mock("@/app/lib/translation/epub-export", () => ({
  buildTranslatedEpub: vi.fn(),
}));

// ── Mock: quality presets ───────────────────────────────────────────
vi.mock("@/app/lib/translation/quality-presets", () => ({
  resolveQualityPreset: vi.fn().mockReturnValue({
    contextChapters: 0,
    contextSummaries: 0,
    useGlossary: false,
  }),
}));

// ── Import SUT after all mocks ──────────────────────────────────────
import { runTranslationJob } from "@/app/lib/translation/service";
import type { ChapterTranslatedEvent } from "@/app/lib/translation/pubsub";

// ── Helpers ─────────────────────────────────────────────────────────

const TRANSLATION_ID = "trans-001";
const USER_ID = "user-1";

function makeRunnerState(overrides?: Record<string, unknown>) {
  return {
    id: TRANSLATION_ID,
    status: TranslationStatus.PENDING,
    novelId: "novel-1",
    providerSnapshot: "OPENAI",
    modelSnapshot: "gpt-4",
    targetLanguage: "Vietnamese",
    contextChapters: 0,
    contextSummaries: 0,
    useGlossary: false,
    totalChapters: 2,
    novel: {
      id: "novel-1",
      userId: USER_ID,
      title: "Test Novel",
      fileType: "txt",
      storagePath: "novels/test.txt",
      updatedAt: new Date(),
      chapterCount: 2,
    },
    ...overrides,
  };
}

function makeJobSummary(overrides?: Record<string, unknown>) {
  return {
    id: TRANSLATION_ID,
    novelId: "novel-1",
    targetLanguage: "Vietnamese",
    providerSnapshot: "OPENAI",
    modelSnapshot: "gpt-4",
    status: TranslationStatus.IN_PROGRESS,
    totalChapters: 2,
    completedChapters: 1,
    failedChapterIndex: null,
    failureReason: null,
    exportPath: null,
    contextChapters: 0,
    contextSummaries: 0,
    useGlossary: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    ...overrides,
  };
}

function setupSuccessfulRun(chapterCount = 2) {
  mockGetTranslationJobForRunner.mockResolvedValue(makeRunnerState({ totalChapters: chapterCount }));
  // Cancellation check — not cancelled
  mockGetTranslationJobById.mockResolvedValue(makeJobSummary({ status: TranslationStatus.IN_PROGRESS, totalChapters: chapterCount }));
  mockSetTranslationInProgress.mockResolvedValue(makeJobSummary({ totalChapters: chapterCount }));
  mockListPendingChaptersForRun.mockResolvedValue(
    Array.from({ length: chapterCount }, (_, i) => ({ chapterIndex: i + 1 }))
  );
  mockMarkChapterTranslating.mockResolvedValue(true);
  mockTranslateChapter.mockResolvedValue({
    translatedTitle: "Translated Title",
    translatedContent: "Translated Content",
    chapterSummary: null,
    detectedTerms: [],
  });
  mockMarkChapterTranslated.mockResolvedValue({});
  mockUpsertNovelTranslatedChapter.mockResolvedValue({});
  // countTranslatedChapters is called once per chapter in the loop, then once in finalize
  mockCountTranslatedChapters.mockResolvedValue(chapterCount);
  mockUpdateTranslationCompletedCount.mockImplementation(async (_id: string, count: number) =>
    makeJobSummary({ completedChapters: count, totalChapters: chapterCount })
  );
  // finalize path: all chapters done → COMPLETED
  mockListTranslatedChaptersForExport.mockResolvedValue(
    Array.from({ length: chapterCount }, (_, i) => ({
      chapterIndex: i + 1,
      translatedTitle: "T",
      translatedContent: "C",
    }))
  );
  mockSetTranslationCompleted.mockResolvedValue(
    makeJobSummary({ status: TranslationStatus.COMPLETED, completedChapters: chapterCount, totalChapters: chapterCount, exportPath: "/tmp/f.txt" })
  );
}

// ── Tests ───────────────────────────────────────────────────────────

describe("runTranslationJob pub/sub integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls publishChapterTranslated once per chapter with correct translationId and chapterIndex", async () => {
    setupSuccessfulRun(2);

    await runTranslationJob({
      translationId: TRANSLATION_ID,
      profileId: "profile-1",
      userId: USER_ID,
    });

    expect(mockPublishChapterTranslated).toHaveBeenCalledTimes(2);

    // First chapter
    const firstCall = mockPublishChapterTranslated.mock.calls[0][0] as ChapterTranslatedEvent;
    expect(firstCall.translationId).toBe(TRANSLATION_ID);
    expect(firstCall.chapterStatus.chapterIndex).toBe(1);

    // Second chapter
    const secondCall = mockPublishChapterTranslated.mock.calls[1][0] as ChapterTranslatedEvent;
    expect(secondCall.translationId).toBe(TRANSLATION_ID);
    expect(secondCall.chapterStatus.chapterIndex).toBe(2);
  });

  it("includes correct payload shape with type, chapterStatus, and job fields", async () => {
    setupSuccessfulRun(1);

    await runTranslationJob({
      translationId: TRANSLATION_ID,
      profileId: "profile-1",
      userId: USER_ID,
    });

    expect(mockPublishChapterTranslated).toHaveBeenCalledTimes(1);

    const event = mockPublishChapterTranslated.mock.calls[0][0] as ChapterTranslatedEvent;

    // type field
    expect(event.type).toBe("chapter-translated");

    // chapterStatus fields
    expect(event.chapterStatus).toEqual(
      expect.objectContaining({
        chapterIndex: 1,
        status: "translated",
      })
    );
    expect(typeof event.chapterStatus.completedAt).toBe("string");
    // Should be a valid ISO timestamp
    expect(new Date(event.chapterStatus.completedAt).toISOString()).toBe(event.chapterStatus.completedAt);

    // job fields
    expect(event.job).toEqual(
      expect.objectContaining({
        id: TRANSLATION_ID,
        completedChapters: expect.any(Number),
        totalChapters: expect.any(Number),
      })
    );
    expect(typeof event.job.status).toBe("string");
    expect(typeof event.job.updatedAt).toBe("string");
  });

  it("continues translation when publishChapterTranslated throws (R031 resilience)", async () => {
    setupSuccessfulRun(2);

    // Make publish throw on every call — simulates the impossible case
    // where the internal catch in publishChapterTranslated somehow fails
    mockPublishChapterTranslated.mockRejectedValue(new Error("catastrophic publish failure"));

    const result = await runTranslationJob({
      translationId: TRANSLATION_ID,
      profileId: "profile-1",
      userId: USER_ID,
    });

    // Translation should still complete successfully
    expect(result.status).toBe("COMPLETED");

    // Both chapters were translated (adapter called twice)
    expect(mockTranslateChapter).toHaveBeenCalledTimes(2);

    // Publish was attempted for both chapters
    expect(mockPublishChapterTranslated).toHaveBeenCalledTimes(2);
  });
});
