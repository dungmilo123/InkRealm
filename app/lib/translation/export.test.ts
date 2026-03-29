import assert from "node:assert/strict";
import test from "node:test";
import { TranslationStatus } from "@/app/generated/prisma/client";
import {
  buildTranslatedExportText,
  canDownloadTranslationExport,
} from "@/app/lib/translation/export";

test("translated export builder preserves chapter order", () => {
  const content = buildTranslatedExportText({
    novelTitle: "Example Novel",
    targetLanguage: "Vietnamese",
    chapters: [
      {
        chapterIndex: 2,
        translatedTitle: "Chuong Hai",
        translatedContent: "Noi dung 2",
      },
      {
        chapterIndex: 1,
        translatedTitle: "Chuong Mot",
        translatedContent: "Noi dung 1",
      },
    ],
  });

  const chapterOnePosition = content.indexOf("Chapter 1: Chuong Mot");
  const chapterTwoPosition = content.indexOf("Chapter 2: Chuong Hai");

  assert.ok(chapterOnePosition >= 0);
  assert.ok(chapterTwoPosition >= 0);
  assert.ok(chapterOnePosition < chapterTwoPosition);
  assert.ok(content.includes("Noi dung 1"));
  assert.ok(content.includes("Noi dung 2"));
});

test("export availability is limited to completed jobs with paths", () => {
  assert.equal(
    canDownloadTranslationExport({
      status: TranslationStatus.COMPLETED,
      exportPath: "/tmp/export.txt",
    }),
    true
  );

  assert.equal(
    canDownloadTranslationExport({
      status: TranslationStatus.COMPLETED,
      exportPath: null,
    }),
    false
  );

  assert.equal(
    canDownloadTranslationExport({
      status: TranslationStatus.FAILED,
      exportPath: "/tmp/export.txt",
    }),
    false
  );
});
