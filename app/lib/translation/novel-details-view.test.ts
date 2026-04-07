import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Novel } from "@/app/generated/prisma/client";
import {
  NovelDetailsView,
  type SerializedTranslationJob,
  type SerializedDefaultProfile,
} from "@/app/novels/[novelId]/novel-details-view";

function createNovel(overrides?: Partial<Novel>): Novel {
  return {
    id: "novel-test-id",
    title: "Sample Novel",
    originalFileName: "sample.epub",
    fileType: "epub",
    mimeType: "application/epub+zip",
    sizeBytes: 2048,
    storagePath: "/tmp/sample.epub",
    userId: "user-test-id",
    createdAt: new Date("2026-03-28T12:00:00.000Z"),
    updatedAt: new Date("2026-03-28T12:00:00.000Z"),
    chapterCount: null,
    ...overrides,
  };
}

function createDefaultProfile(): SerializedDefaultProfile {
  return {
    id: "profile-1",
    provider: "OPENAI",
    model: "gpt-4o-mini",
    createdAt: "2026-03-28T12:00:00.000Z",
    updatedAt: "2026-03-28T12:00:00.000Z",
  };
}

function createLatestJob(): SerializedTranslationJob {
  return {
    id: "job-1",
    novelId: "novel-test-id",
    targetLanguage: "Vietnamese",
    providerSnapshot: "OPENAI",
    modelSnapshot: "gpt-4o-mini",
    status: "COMPLETED",
    totalChapters: 2,
    completedChapters: 2,
    failedChapterIndex: null,
    failureReason: null,
    exportPath: "/tmp/export-job-1.txt",
    createdAt: "2026-03-28T12:00:00.000Z",
    updatedAt: "2026-03-28T12:10:00.000Z",
    progressPercent: 100,
    downloadUrl: "/api/translation/jobs/job-1/export",
  };
}

test("novel details view shows metadata, reading entry, and translation progress controls", () => {
  const html = renderToStaticMarkup(
    createElement(NovelDetailsView, {
      novel: createNovel(),
      readerSummary: {
        isReadable: true,
        chapterCount: 2,
        totalWordCount: 5000,
      },
      readingProgress: null,
      translationDataError: null,
      serializedDefaultProfile: createDefaultProfile(),
      serializedLatestJob: createLatestJob(),
      chapterCount: 2,
      initialChapterStatuses: [],
    })
  );

  expect(html).toContain("Sample Novel");
  expect(html).toContain("sample.epub");
  expect(html).toContain("2.0 KB");
  expect(html).toContain("Start Reading");
  expect(html).toContain("/novels/novel-test-id/read/1");
});

test("novel details view shows reader-unavailable state and hides translation start form", () => {
  const html = renderToStaticMarkup(
    createElement(NovelDetailsView, {
      novel: createNovel({
        fileType: "txt",
        originalFileName: "unreadable.txt",
      }),
      readerSummary: {
        isReadable: false,
        chapterCount: 0,
        unavailableReason: "Could not read this text file from storage.",
        totalWordCount: 0,
      },
      readingProgress: null,
      translationDataError: null,
      serializedDefaultProfile: null,
      serializedLatestJob: null,
      chapterCount: 0,
      initialChapterStatuses: [],
    })
  );

  expect(html).toContain("In-app reading is unavailable for this novel.");
  expect(html).toContain("Could not read this text file from storage.");

  expect(html.includes("Start Reading")).toBe(false);
  expect(html.includes("/novels/novel-test-id/read/1")).toBe(false);
});

test("novel details view shows translation data error banner", () => {
  const html = renderToStaticMarkup(
    createElement(NovelDetailsView, {
      novel: createNovel(),
      readerSummary: {
        isReadable: true,
        chapterCount: 2,
        totalWordCount: 5000,
      },
      readingProgress: null,
      translationDataError: "Translation data is currently unavailable.",
      serializedDefaultProfile: null,
      serializedLatestJob: null,
      chapterCount: 2,
      initialChapterStatuses: [],
    })
  );

  expect(html).toContain("Translation data is currently unavailable.");
});

test("novel details view shows Continue Reading when progress exists", () => {
  const html = renderToStaticMarkup(
    createElement(NovelDetailsView, {
      novel: createNovel(),
      readerSummary: {
        isReadable: true,
        chapterCount: 10,
        totalWordCount: 25000,
      },
      readingProgress: {
        lastChapterIndex: 5,
        visitedChapterIndices: [1, 2, 3, 4, 5],
      },
      translationDataError: null,
      serializedDefaultProfile: null,
      serializedLatestJob: null,
      chapterCount: 10,
      initialChapterStatuses: [],
    })
  );

  expect(html).toContain("Continue Reading");
  expect(html).toContain("Chapter 5");
  expect(html).toContain("/novels/novel-test-id/read/5");
  expect(html.includes("Start Reading")).toBe(false);
});
