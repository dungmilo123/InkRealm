import assert from "node:assert/strict";
import test from "node:test";
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
      },
      readingProgress: null,
      translationDataError: null,
      serializedDefaultProfile: createDefaultProfile(),
      serializedLatestJob: createLatestJob(),
      chapterCount: 2,
      initialChapterStatuses: [],
    })
  );

  assert.ok(html.includes("Sample Novel"));
  assert.ok(html.includes("sample.epub"));
  assert.ok(html.includes("2.0 KB"));
  assert.ok(html.includes("Start Reading"));
  assert.ok(html.includes("/novels/novel-test-id/read/1"));
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
      },
      readingProgress: null,
      translationDataError: null,
      serializedDefaultProfile: null,
      serializedLatestJob: null,
      chapterCount: 0,
      initialChapterStatuses: [],
    })
  );

  assert.ok(html.includes("In-app reading is unavailable for this novel."));
  assert.ok(html.includes("Could not read this text file from storage."));

  assert.equal(html.includes("Start Reading"), false);
  assert.equal(html.includes("/novels/novel-test-id/read/1"), false);
});

test("novel details view shows translation data error banner", () => {
  const html = renderToStaticMarkup(
    createElement(NovelDetailsView, {
      novel: createNovel(),
      readerSummary: {
        isReadable: true,
        chapterCount: 2,
      },
      readingProgress: null,
      translationDataError: "Translation data is currently unavailable.",
      serializedDefaultProfile: null,
      serializedLatestJob: null,
      chapterCount: 2,
      initialChapterStatuses: [],
    })
  );

  assert.ok(html.includes("Translation data is currently unavailable."));
});

test("novel details view shows Continue Reading when progress exists", () => {
  const html = renderToStaticMarkup(
    createElement(NovelDetailsView, {
      novel: createNovel(),
      readerSummary: {
        isReadable: true,
        chapterCount: 10,
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

  assert.ok(html.includes("Continue Reading"));
  assert.ok(html.includes("Chapter 5"));
  assert.ok(html.includes("/novels/novel-test-id/read/5"));
  assert.equal(html.includes("Start Reading"), false);
});
