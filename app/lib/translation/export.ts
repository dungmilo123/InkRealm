import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { TranslationStatus } from "@/app/generated/prisma/client";

const TRANSLATION_EXPORT_DIR = join(process.cwd(), "storage", "translations");

export type ExportChapter = {
  chapterIndex: number;
  translatedTitle: string | null;
  translatedContent: string | null;
};

export function buildTranslatedExportText(input: {
  novelTitle: string;
  targetLanguage: string;
  chapters: ExportChapter[];
}) {
  const ordered = [...input.chapters].sort(
    (left, right) => left.chapterIndex - right.chapterIndex
  );

  const lines: string[] = [
    `${input.novelTitle} (${input.targetLanguage} translation)`,
    "",
  ];

  for (const chapter of ordered) {
    lines.push(
      `Chapter ${chapter.chapterIndex}: ${chapter.translatedTitle ?? `Chapter ${chapter.chapterIndex}`}`
    );
    lines.push("");
    lines.push(chapter.translatedContent ?? "");
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

async function ensureTranslationExportDir() {
  await mkdir(TRANSLATION_EXPORT_DIR, { recursive: true });
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9\-\s_]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function writeTranslatedExportFile(input: {
  translationId: string;
  novelTitle: string;
  targetLanguage: string;
  chapters: ExportChapter[];
}) {
  await ensureTranslationExportDir();

  const safeNovelName = sanitizeFileName(input.novelTitle) || "novel";
  const safeLanguage = sanitizeFileName(input.targetLanguage) || "translated";
  const fileName = `${safeNovelName}-${safeLanguage}-${input.translationId}.txt`;
  const filePath = join(TRANSLATION_EXPORT_DIR, fileName);
  const content = buildTranslatedExportText({
    novelTitle: input.novelTitle,
    targetLanguage: input.targetLanguage,
    chapters: input.chapters,
  });

  await writeFile(filePath, content, "utf8");

  return {
    fileName,
    filePath,
  };
}

export function canDownloadTranslationExport(input: {
  status: TranslationStatus;
  exportPath: string | null;
}) {
  return input.status === TranslationStatus.COMPLETED && Boolean(input.exportPath);
}

export async function readTranslatedExportFile(exportPath: string): Promise<Buffer> {
  return readFile(exportPath);
}

/**
 * Deletes a translated export file from local storage.
 * Silently ignores ENOENT (file already removed / never written).
 */
export async function deleteTranslatedExportFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw err;
  }
}
