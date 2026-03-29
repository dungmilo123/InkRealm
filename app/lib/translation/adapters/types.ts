import type { TranslationProvider } from "@/app/generated/prisma/client";

export type TranslationAdapterContext = {
  provider: TranslationProvider;
  model: string;
  apiKey: string;
  baseUrl: string | null;
};

export type GlossaryPromptEntry = {
  canonical: string;
  type: string;
  status: "confirmed" | "pending";
  variants: string[];
};

export type ChapterContext = {
  chapterIndex: number;
  translatedContent: string;
  summary?: string | null;
};

export type TranslateChapterInput = {
  targetLanguage: string;
  sourceTitle: string;
  sourceContent: string;
  glossary?: GlossaryPromptEntry[];
  previousContext?: ChapterContext[];
};

export type DetectedTerm = {
  canonical: string;
  type?: string;
  variants?: string[];
};

export type TranslateChapterOutput = {
  translatedTitle: string;
  translatedContent: string;
  detectedTerms?: DetectedTerm[];
  chapterSummary?: string;
};

export interface TranslationAdapter {
  translateChapter(
    context: TranslationAdapterContext,
    input: TranslateChapterInput
  ): Promise<TranslateChapterOutput>;
}
