import type { TranslationProvider } from "@/app/generated/prisma/client";

export type TranslationAdapterContext = {
  provider: TranslationProvider;
  model: string;
  apiKey: string;
  baseUrl: string | null;
};

export type TranslateChapterInput = {
  targetLanguage: string;
  sourceTitle: string;
  sourceContent: string;
};

export type TranslateChapterOutput = {
  translatedTitle: string;
  translatedContent: string;
};

export interface TranslationAdapter {
  translateChapter(
    context: TranslationAdapterContext,
    input: TranslateChapterInput
  ): Promise<TranslateChapterOutput>;
}
