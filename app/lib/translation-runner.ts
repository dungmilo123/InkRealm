import { getTranslationProfile, getNovelTranslation, getTranslationWithChapters, updateTranslationStatus, updateChapterTranslation, ensureTranslationChapters, createNovelTranslation } from "./translation";
import { createProviderAdapter } from "./translation-provider";
import { getReaderDocument } from "./reader/service";
import { prisma } from "./prisma";
import type { TranslationProvider } from "../generated/prisma/client";

export interface TranslationRunnerState {
  translationId: string;
  novelId: string;
  status: "idle" | "running" | "completed" | "failed";
  totalChapters: number;
  completedChapters: number;
  failedChapterIndex?: number;
  error?: string;
}

export async function startTranslation(
  novelId: string,
  targetLanguage: string
): Promise<{ success: boolean; translationId?: string; error?: string }> {
  const profile = await getTranslationProfile();
  if (!profile) {
    return { success: false, error: "No translation profile configured" };
  }

  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) {
    return { success: false, error: "Novel not found" };
  }

  const existingTranslation = await getNovelTranslation(novelId);
  if (existingTranslation && existingTranslation.status !== "FAILED") {
    return { success: false, error: "Translation already in progress or completed" };
  }

  try {
    const readerDoc = await getReaderDocument(novel);
    
    const translation = await createNovelTranslation({
      novelId,
      targetLanguage,
      providerSnapshot: profile.provider as TranslationProvider,
      modelSnapshot: profile.model,
      totalChapters: readerDoc.chapterCount,
    });

    await ensureTranslationChapters(translation.id, readerDoc.chapters);
    
    await updateTranslationStatus(translation.id, "PENDING");

    return { success: true, translationId: translation.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start translation" };
  }
}

export async function resumeTranslation(
  translationId: string
): Promise<{ success: boolean; error?: string }> {
  const translation = await getTranslationWithChapters(translationId);
  if (!translation) {
    return { success: false, error: "Translation not found" };
  }

  if (translation.status === "COMPLETED") {
    return { success: false, error: "Translation already completed" };
  }

  const profile = await getTranslationProfile();
  if (!profile) {
    return { success: false, error: "No translation profile configured" };
  }

  const novel = await prisma.novel.findUnique({ where: { id: translation.novelId } });
  if (!novel) {
    return { success: false, error: "Novel not found" };
  }

  try {
    const adapter = await createProviderAdapter({
      provider: profile.provider as TranslationProvider,
      model: profile.model,
      encryptedApiKey: profile.encryptedApiKey,
      baseUrl: profile.baseUrl,
    });

    await updateTranslationStatus(translation.id, "IN_PROGRESS");

    const pendingChapters = translation.chapters.filter(
      (c) => c.status === "PENDING" || c.status === "FAILED"
    );

    for (const chapter of pendingChapters) {
      try {
        await updateChapterTranslation(translation.id, chapter.chapterIndex, {
          status: "TRANSLATING",
        });

        const { getReaderChapter } = await import("./reader/service");
        const { chapter: readerChapter } = await getReaderChapter(novel, chapter.chapterIndex);

        const originalText = readerChapter.paragraphs.join("\n\n");
        console.log(`[Translation] Chapter ${chapter.chapterIndex} original text length: ${originalText.length}`);
        
        const result = await adapter.translate({
          text: originalText,
          targetLanguage: translation.targetLanguage,
        });

        console.log(`[Translation] Chapter ${chapter.chapterIndex} translated text length: ${result.translatedText.length}`);
        console.log(`[Translation] Chapter ${chapter.chapterIndex} translated text preview: ${result.translatedText.substring(0, 200)}`);

        const translatedParagraphs = result.translatedText
          .split("\n\n")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        await updateChapterTranslation(translation.id, chapter.chapterIndex, {
          status: "TRANSLATED",
          translatedTitle: chapter.originalTitle,
          translatedContent: translatedParagraphs.join("\n\n"),
        });

        const updatedTranslation = await prisma.novelTranslation.findUnique({
          where: { id: translationId },
        });
        if (updatedTranslation) {
          await updateTranslationStatus(translationId, "IN_PROGRESS", {
            completedChapters: updatedTranslation.completedChapters + 1,
          });
        }
      } catch (chapterError) {
        await updateChapterTranslation(translation.id, chapter.chapterIndex, {
          status: "FAILED",
          errorMessage: chapterError instanceof Error ? chapterError.message : "Translation failed",
        });

        await updateTranslationStatus(translationId, "FAILED", {
          failedChapterIndex: chapter.chapterIndex,
          failureReason: chapterError instanceof Error ? chapterError.message : "Translation failed",
        });

        return { success: false, error: `Chapter ${chapter.chapterIndex} failed: ${chapterError instanceof Error ? chapterError.message : "Unknown error"}` };
      }
    }

    await updateTranslationStatus(translationId, "COMPLETED", {
      completedChapters: translation.totalChapters,
    });

    return { success: true };
  } catch (error) {
    await updateTranslationStatus(translationId, "FAILED", {
      failureReason: error instanceof Error ? error.message : "Translation runner failed",
    });
    return { success: false, error: error instanceof Error ? error.message : "Translation runner failed" };
  }
}

export async function getTranslationProgress(
  translationId: string
): Promise<{
  status: string;
  totalChapters: number;
  completedChapters: number;
  failedChapterIndex?: number;
  failureReason?: string;
  chapters: Array<{
    chapterIndex: number;
    status: string;
    originalTitle: string;
    hasTranslation: boolean;
  }>;
} | null> {
  const translation = await getTranslationWithChapters(translationId);
  if (!translation) {
    return null;
  }

  return {
    status: translation.status,
    totalChapters: translation.totalChapters,
    completedChapters: translation.completedChapters,
    failedChapterIndex: translation.failedChapterIndex ?? undefined,
    failureReason: translation.failureReason ?? undefined,
    chapters: translation.chapters.map((c) => ({
      chapterIndex: c.chapterIndex,
      status: c.status,
      originalTitle: c.originalTitle,
      hasTranslation: c.status === "TRANSLATED" && !!c.translatedContent,
    })),
  };
}