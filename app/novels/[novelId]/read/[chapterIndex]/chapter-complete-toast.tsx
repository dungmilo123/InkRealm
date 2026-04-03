"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronRight, BookOpen } from "lucide-react";
import { estimateReadingMinutes, formatReadingTime } from "@/lib/reading-time";

type ChapterCompleteToastProps = {
  /** Current scroll progress 0-1 */
  scrollProgress: number;
  /** Current chapter index (1-based) */
  currentChapterIndex: number;
  /** Total chapters in novel */
  chapterCount: number;
  /** Novel ID for building next chapter href */
  novelId: string;
  /** All chapters with titles and word counts */
  chapters: { index: number; title: string; wordCount: number }[];
};

/**
 * A subtle bottom toast that appears when the reader reaches the end of a chapter.
 *
 * Shows:
 * - Completion confirmation with chapter progress (e.g., "Chapter 3 of 12 complete")
 * - Next chapter preview with title and estimated reading time
 * - Direct link to the next chapter
 * - "Novel complete!" celebration when finishing the last chapter
 *
 * Visibility: appears when scrollProgress ≥ 0.97, fades out when scrolling back up.
 * Uses CSS transitions for smooth slide-up animation.
 */
export function ChapterCompleteToast({
  scrollProgress,
  currentChapterIndex,
  chapterCount,
  novelId,
  chapters,
}: ChapterCompleteToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const isVisible = scrollProgress >= 0.97 && !dismissed;

  // Reset dismissed state when chapter changes (navigating to a new chapter)
  useEffect(() => {
    queueMicrotask(() => setDismissed(false));
  }, [currentChapterIndex]);

  const isLastChapter = currentChapterIndex >= chapterCount;
  const nextChapterIndex = currentChapterIndex + 1;
  const nextChapter = chapters.find((ch) => ch.index === nextChapterIndex);
  const nextChapterHref = !isLastChapter
    ? `/novels/${novelId}/read/${nextChapterIndex}`
    : null;

  const nextReadingTime = nextChapter?.wordCount
    ? formatReadingTime(estimateReadingMinutes(nextChapter.wordCount))
    : null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none transition-all duration-300 ease-out ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto mb-6 mx-4 max-w-lg w-full rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg px-5 py-4">
        {isLastChapter ? (
          /* Novel complete state */
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 rounded-full bg-green-500/15 p-2">
              <BookOpen className="h-5 w-5 text-green-500" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Novel complete!
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You&apos;ve finished all {chapterCount} chapters
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        ) : nextChapter && nextChapterHref ? (
          /* Next chapter preview */
          <Link
            href={nextChapterHref}
            className="flex items-center gap-3 group"
          >
            <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
              <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                Chapter {currentChapterIndex} of {chapterCount} complete
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                Next: {nextChapter.title}
              </p>
              {nextReadingTime && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  ~{nextReadingTime} read
                </p>
              )}
            </div>
            <ChevronRight
              className="h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
