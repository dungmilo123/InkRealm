import type { ParsedReaderChapter } from "./types";

const CHAPTER_HEADING_PATTERN =
  /^(chapter|book|part|section|prologue|epilogue)\b[\s\divxlcdm.,:;()_-]*$/i;

function normalizeNewLines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function cleanupInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitParagraphs(content: string): string[] {
  const lines = normalizeNewLines(content)
    .split("\n")
    .map((line) => line.trim());

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length === 0) {
      return;
    }

    const paragraph = cleanupInlineWhitespace(currentParagraph.join(" "));
    if (paragraph.length > 0) {
      paragraphs.push(paragraph);
    }

    currentParagraph = [];
  };

  for (const line of lines) {
    if (line.length === 0) {
      flushParagraph();
      continue;
    }

    currentParagraph.push(line);
  }

  flushParagraph();

  return paragraphs;
}

function isLikelyChapterHeading(line: string): boolean {
  const heading = line.trim();

  if (heading.length === 0 || heading.length > 120) {
    return false;
  }

  if (CHAPTER_HEADING_PATTERN.test(heading)) {
    return true;
  }

  const shortAllCapsHeading =
    heading.length <= 60 &&
    /[A-Z]/.test(heading) &&
    heading === heading.toUpperCase() &&
    !/[.!?]/.test(heading);

  return shortAllCapsHeading;
}

function fallbackSingleChapter(text: string): ParsedReaderChapter[] {
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) {
    return [];
  }

  return [{ title: "Chapter 1", paragraphs }];
}

export function extractTxtChapters(rawText: string): ParsedReaderChapter[] {
  const normalizedText = normalizeNewLines(rawText).replace(/^\uFEFF/, "").trim();

  if (normalizedText.length === 0) {
    return [];
  }

  const lines = normalizedText.split("\n");
  const chapters: ParsedReaderChapter[] = [];

  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  const flushChapter = () => {
    const paragraphs = splitParagraphs(currentLines.join("\n"));

    if (paragraphs.length === 0) {
      currentLines = [];
      return;
    }

    chapters.push({
      title: currentTitle ?? `Chapter ${chapters.length + 1}`,
      paragraphs,
    });

    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (isLikelyChapterHeading(trimmed)) {
      if (currentLines.length > 0) {
        flushChapter();
      }

      currentTitle = cleanupInlineWhitespace(trimmed);
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    flushChapter();
  }

  if (chapters.length === 0) {
    return fallbackSingleChapter(normalizedText);
  }

  return chapters.map((chapter, index) => ({
    ...chapter,
    title: chapter.title || `Chapter ${index + 1}`,
  }));
}
