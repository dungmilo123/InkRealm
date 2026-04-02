import { readFile } from "fs/promises";
import { extname } from "path";
import type { Novel } from "@/app/generated/prisma/client";
import { extractEpubChapters } from "./epub";
import { extractTxtChapters } from "./text";
import {
  getCachedDocument,
  setCachedDocument,
} from "./cache";
import {
  InvalidChapterIndexError,
  ReaderUnavailableError,
  type ParsedReaderChapter,
  type ReaderChapter,
  type ReaderDocument,
  type ReaderSummary,
} from "./types";
import { countWordsInParagraphs } from "@/lib/reading-time";

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeParagraphs(paragraphs: string[]): string[] {
  return paragraphs
    .map((paragraph) => normalizeInlineWhitespace(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

function normalizeChapters(chapters: ParsedReaderChapter[]): ReaderChapter[] {
  const nonEmptyChapters = chapters
    .map((chapter) => ({
      title: normalizeInlineWhitespace(chapter.title),
      paragraphs: normalizeParagraphs(chapter.paragraphs),
    }))
    .filter((chapter) => chapter.paragraphs.length > 0);

  return nonEmptyChapters.map((chapter, index) => ({
    index: index + 1,
    title: chapter.title || `Chapter ${index + 1}`,
    paragraphs: chapter.paragraphs,
  }));
}

function resolveNovelFormat(novel: Novel): "txt" | "epub" | null {
  if (novel.fileType === "txt" || novel.fileType === "epub") {
    return novel.fileType;
  }

  const extension = extname(novel.storagePath).toLowerCase();
  if (extension === ".txt") {
    return "txt";
  }

  if (extension === ".epub") {
    return "epub";
  }

  return null;
}

async function parseNovelChapters(novel: Novel): Promise<ParsedReaderChapter[]> {
  const format = resolveNovelFormat(novel);

  if (!format) {
    throw new ReaderUnavailableError(
      `Unsupported novel format: ${novel.fileType || "unknown"}.`
    );
  }

  if (format === "txt") {
    try {
      const text = await readFile(novel.storagePath, "utf-8");
      return extractTxtChapters(text);
    } catch {
      throw new ReaderUnavailableError(
        "Could not read this text file from storage."
      );
    }
  }

  try {
    const epubBuffer = await readFile(novel.storagePath);
    return extractEpubChapters(epubBuffer);
  } catch {
    throw new ReaderUnavailableError(
      "Could not read this EPUB file from storage."
    );
  }
}

export async function getReaderDocument(novel: Novel): Promise<ReaderDocument> {
  const cached = getCachedDocument(novel.id, novel.updatedAt);
  if (cached) return cached;

  const parsedChapters = await parseNovelChapters(novel);
  const chapters = normalizeChapters(parsedChapters);

  if (chapters.length === 0) {
    throw new ReaderUnavailableError(
      "This novel could not be converted into readable chapters."
    );
  }

  const document: ReaderDocument = {
    novelId: novel.id,
    novelTitle: novel.title,
    fileType: novel.fileType,
    chapters,
    chapterCount: chapters.length,
  };

  setCachedDocument(novel.id, novel.updatedAt, document);
  return document;
}

export async function getReaderSummary(novel: Novel): Promise<ReaderSummary> {
  try {
    const document = await getReaderDocument(novel);

    if (novel.chapterCount == null) {
      const { updateNovelChapterCount } = await import("@/app/lib/novels");
      void updateNovelChapterCount(novel.id, document.chapterCount);
    }

    const chapters = document.chapters.map((ch) => {
      const wordCount = countWordsInParagraphs(ch.paragraphs);
      return { index: ch.index, title: ch.title, wordCount };
    });

    const totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      isReadable: true,
      chapterCount: document.chapterCount,
      chapters,
      totalWordCount,
    };
  } catch (error) {
    if (error instanceof ReaderUnavailableError) {
      return {
        isReadable: false,
        chapterCount: 0,
        unavailableReason: error.message,
        totalWordCount: 0,
      };
    }

    throw error;
  }
}

export async function getReaderChapter(
  novel: Novel,
  chapterIndex: number
): Promise<{ document: ReaderDocument; chapter: ReaderChapter }> {
  if (!Number.isInteger(chapterIndex) || chapterIndex <= 0) {
    throw new InvalidChapterIndexError();
  }

  const document = await getReaderDocument(novel);
  const chapter = document.chapters[chapterIndex - 1];

  if (!chapter) {
    throw new InvalidChapterIndexError();
  }

  return { document, chapter };
}
