import { ChapterTranslationStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { TranslationHttpError } from "@/app/lib/translation/errors";

export type ReplacementMatch = {
  chapterId: string;
  chapterIndex: number;
  translatedTitle: string | null;
  matches: Array<{
    variant: string;
    occurrences: number;
    contextSnippets: string[];
  }>;
};

/**
 * Fetches a glossary entry and verifies ownership of its parent novel —
 * in a single database round-trip.
 */
async function getOwnedEntryWithVariants(
  entryId: string,
  novelId: string,
  userId: string
) {
  const entry = await prisma.novelGlossaryEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      novelId: true,
      canonical: true,
      variants: { select: { variant: true } },
      novel: { select: { userId: true } },
    },
  });

  if (!entry) {
    throw new TranslationHttpError(404, "Glossary entry not found.");
  }

  if (entry.novel.userId !== userId) {
    throw new TranslationHttpError(404, "Novel not found.");
  }

  if (entry.novelId !== novelId) {
    throw new TranslationHttpError(404, "Glossary entry not found.");
  }

  return entry;
}

export async function previewGlossaryReplacement(input: {
  entryId: string;
  novelId: string;
  userId: string;
}): Promise<ReplacementMatch[]> {
  const entry = await getOwnedEntryWithVariants(
    input.entryId,
    input.novelId,
    input.userId
  );

  if (entry.variants.length === 0) {
    return [];
  }

  const translations = await prisma.novelTranslation.findMany({
    where: { novelId: input.novelId },
    select: { id: true },
  });

  const translationIds = translations.map((t) => t.id);
  if (translationIds.length === 0) return [];

  const chapters = await prisma.novelTranslationChapter.findMany({
    where: {
      translationId: { in: translationIds },
      status: ChapterTranslationStatus.TRANSLATED,
      translatedContent: { not: null },
    },
    orderBy: { chapterIndex: "asc" },
    select: {
      id: true,
      chapterIndex: true,
      translatedTitle: true,
      translatedContent: true,
    },
  });

  const results: ReplacementMatch[] = [];

  for (const chapter of chapters) {
    const content = chapter.translatedContent ?? "";
    const chapterMatches: ReplacementMatch["matches"] = [];

    for (const v of entry.variants) {
      const variantStr = v.variant;
      const occurrences = countOccurrences(content, variantStr);
      if (occurrences > 0) {
        chapterMatches.push({
          variant: variantStr,
          occurrences,
          contextSnippets: extractContextSnippets(content, variantStr, 3),
        });
      }
    }

    if (chapterMatches.length > 0) {
      results.push({
        chapterId: chapter.id,
        chapterIndex: chapter.chapterIndex,
        translatedTitle: chapter.translatedTitle,
        matches: chapterMatches,
      });
    }
  }

  return results;
}

export async function applyGlossaryReplacement(input: {
  entryId: string;
  novelId: string;
  userId: string;
}): Promise<{ chaptersUpdated: number; totalReplacements: number }> {
  const entry = await getOwnedEntryWithVariants(
    input.entryId,
    input.novelId,
    input.userId
  );

  if (entry.variants.length === 0) {
    return { chaptersUpdated: 0, totalReplacements: 0 };
  }

  const translations = await prisma.novelTranslation.findMany({
    where: { novelId: input.novelId },
    select: { id: true },
  });

  const translationIds = translations.map((t) => t.id);
  if (translationIds.length === 0) {
    return { chaptersUpdated: 0, totalReplacements: 0 };
  }

  const chapters = await prisma.novelTranslationChapter.findMany({
    where: {
      translationId: { in: translationIds },
      status: ChapterTranslationStatus.TRANSLATED,
      translatedContent: { not: null },
    },
    select: {
      id: true,
      translatedContent: true,
    },
  });

  let chaptersUpdated = 0;
  let totalReplacements = 0;

  for (const chapter of chapters) {
    let content = chapter.translatedContent ?? "";
    let chapterReplacements = 0;

    for (const v of entry.variants) {
      const count = countOccurrences(content, v.variant);
      if (count > 0) {
        content = replaceAll(content, v.variant, entry.canonical);
        chapterReplacements += count;
      }
    }

    if (chapterReplacements > 0) {
      await prisma.novelTranslationChapter.update({
        where: { id: chapter.id },
        data: { translatedContent: content },
      });
      chaptersUpdated++;
      totalReplacements += chapterReplacements;
    }
  }

  return { chaptersUpdated, totalReplacements };
}

function countOccurrences(text: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

function extractContextSnippets(
  text: string,
  search: string,
  maxSnippets: number,
  contextChars = 50
): string[] {
  const snippets: string[] = [];
  let pos = 0;

  while (snippets.length < maxSnippets && (pos = text.indexOf(search, pos)) !== -1) {
    const start = Math.max(0, pos - contextChars);
    const end = Math.min(text.length, pos + search.length + contextChars);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < text.length ? "..." : "";
    snippets.push(`${prefix}${text.slice(start, end)}${suffix}`);
    pos += search.length;
  }

  return snippets;
}
