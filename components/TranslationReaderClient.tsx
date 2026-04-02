"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface TranslationChapter {
  chapterIndex: number;
  originalTitle: string;
  translatedTitle?: string;
  translatedContent?: string;
  status: string;
}

interface TranslationData {
  hasTranslation: boolean;
  translation?: {
    id: string;
    status: string;
    targetLanguage: string;
    totalChapters: number;
    completedChapters: number;
    chapters: TranslationChapter[];
  };
}

interface ReaderChapter {
  index: number;
  title: string;
  paragraphs: string[];
}

interface TranslatedChapterContent {
  title: string;
  paragraphs: string[];
}

interface TranslationReaderClientProps {
  novelId: string;
  novelTitle: string;
  initialChapterIndex: number;
  totalChapters: number;
  initialChapter: ReaderChapter;
}

export function TranslationReaderClient({
  novelId,
  novelTitle,
  initialChapterIndex,
  totalChapters,
  initialChapter,
}: TranslationReaderClientProps) {
  const [version, setVersion] = useState<"original" | "translated">("original");
  const [currentChapter] = useState(initialChapterIndex);
  const [originalChapter] = useState(initialChapter);
  const [translatedChapter, setTranslatedChapter] = useState<TranslatedChapterContent | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTranslationInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/translation/novel?novelId=${novelId}`);
      if (response.ok) {
        const data = await response.json();
        setTranslationInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch translation info:", error);
    }
  }, [novelId]);

  useEffect(() => {
    fetchTranslationInfo();
  }, [fetchTranslationInfo]);

  useEffect(() => {
    async function fetchChapters() {
      if (version === "translated") {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/translation/chapter?novelId=${novelId}&chapterIndex=${currentChapter}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.translatedContent) {
              const paragraphs = data.translatedContent
                .split("\n\n")
                .filter((p: string) => p.trim());
              setTranslatedChapter({
                title: data.translatedTitle || data.originalTitle,
                paragraphs,
              });
            } else {
              setTranslatedChapter(null);
            }
          } else {
            setTranslatedChapter(null);
          }
        } catch {
          setTranslatedChapter(null);
        } finally {
          setLoading(false);
        }
      } else {
        setTranslatedChapter(null);
      }
    }

    fetchChapters();
  }, [novelId, currentChapter, version]);

  const canViewTranslated = translationInfo?.hasTranslation &&
    translationInfo.translation?.status === "COMPLETED";

  const hasTranslatedContentForChapter = canViewTranslated &&
    translationInfo?.translation?.chapters?.some(
      (c) => c.chapterIndex === currentChapter && c.status === "TRANSLATED"
    );

  const toggleVersion = () => {
    if (version === "original" && !hasTranslatedContentForChapter) {
      return;
    }
    setVersion((v) => (v === "original" ? "translated" : "original"));
  };

  const currentContent = version === "translated" && translatedChapter
    ? translatedChapter
    : { title: originalChapter.title, paragraphs: originalChapter.paragraphs };

  const baseHref = `/novels/${novelId}/read`;
  const versionParam = version === "translated" ? "?version=translated" : "";

  const previousChapterHref =
    currentChapter > 1 ? `${baseHref}/${currentChapter - 1}${versionParam}` : null;
  const nextChapterHref =
    currentChapter < totalChapters ? `${baseHref}/${currentChapter + 1}${versionParam}` : null;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm mb-3">
            <Link
              href={`/novels/${novelId}`}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Novel details
            </Link>
            <Link
              href="/dashboard"
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Library
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              {currentContent.title}
            </h1>
            {canViewTranslated && (
              <button
                onClick={toggleVersion}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  version === "translated"
                    ? "bg-primary text-primary-foreground"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                } ${version === "original" && !hasTranslatedContentForChapter ? "opacity-50 cursor-not-allowed" : ""}`}
                title={version === "original" && !hasTranslatedContentForChapter ? "Translation not available for this chapter" : undefined}
              >
                {version === "original" ? "Translated" : "Original"}
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {novelTitle} · Chapter {currentChapter} of {totalChapters}
            {version === "translated" && (
              translationInfo?.translation?.targetLanguage
                ? ` · ${translationInfo.translation.targetLanguage}`
                : ""
            )}
            {loading && version === "translated" && " · Loading..."}
          </p>
        </div>
      </header>

      <main className="w-full max-w-3xl mx-auto px-8 py-8">
        <article className="p-6 md:p-8 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-6 leading-8 text-zinc-800 dark:text-zinc-100">
          {loading && version === "translated" ? (
            <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading translated chapter" role="status">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6" />
            </div>
          ) : translatedChapter || version === "original" ? (
            currentContent.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={`${currentChapter}-${paragraphIndex}`}>{paragraph}</p>
            ))
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground italic">
                This chapter has not been translated yet.
              </p>
              <button
                onClick={() => setVersion("original")}
                className="text-sm text-primary hover:underline"
              >
                View original instead
              </button>
            </div>
          )}
        </article>

        <nav className="mt-6 flex items-center justify-between gap-4">
          {previousChapterHref ? (
            <Link
              href={previousChapterHref}
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 dark:border-zinc-700 px-5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Previous chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-5 text-sm text-zinc-400 dark:text-zinc-500">
              Start of novel
            </span>
          )}

          {nextChapterHref ? (
            <Link
              href={nextChapterHref}
              className="inline-flex h-10 items-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Next chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-5 text-sm text-zinc-400 dark:text-zinc-500">
              End of novel
            </span>
          )}
        </nav>
      </main>
    </div>
  );
}