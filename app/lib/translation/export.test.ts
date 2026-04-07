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

  expect(chapterOnePosition >= 0).toBeTruthy();
  expect(chapterTwoPosition >= 0).toBeTruthy();
  expect(chapterOnePosition < chapterTwoPosition).toBeTruthy();
  expect(content).toContain("Noi dung 1");
  expect(content).toContain("Noi dung 2");
});

test("export availability is limited to completed jobs with paths", () => {
  expect(canDownloadTranslationExport({
    status: TranslationStatus.COMPLETED,
    exportPath: "/tmp/export.txt",
  })).toBe(true);

  expect(canDownloadTranslationExport({
    status: TranslationStatus.COMPLETED,
    exportPath: null,
  })).toBe(false);

  expect(canDownloadTranslationExport({
    status: TranslationStatus.FAILED,
    exportPath: "/tmp/export.txt",
  })).toBe(false);
});
