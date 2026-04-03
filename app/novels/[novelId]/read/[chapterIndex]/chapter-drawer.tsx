"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { X, Bookmark } from "lucide-react";
import { estimateReadingMinutes } from "@/lib/reading-time";

type ChapterInfo = {
  index: number;
  title: string;
  wordCount: number;
};

type ChapterDrawerProps = {
  novelId: string;
  chapters: ChapterInfo[];
  currentChapterIndex: number;
  /** Set of chapter indices the user has bookmarked */
  bookmarkedChapterIndices: Set<number>;
  onClose: () => void;
};

/**
 * Slide-out drawer showing the full chapter table of contents.
 * Opens from the left side of the viewport.
 * Current chapter is highlighted and auto-scrolled into view.
 */
export function ChapterDrawer({
  novelId,
  chapters,
  currentChapterIndex,
  bookmarkedChapterIndices,
  onClose,
}: ChapterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const activeChapterRef = useRef<HTMLAnchorElement>(null);

  // Auto-scroll the current chapter into view on mount
  useEffect(() => {
    if (activeChapterRef.current) {
      activeChapterRef.current.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    }
  }, []);

  // Close on Escape or clicking outside
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "c") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm">
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chapter table of contents"
        className="fixed inset-y-0 left-0 z-[91] w-80 max-w-[85vw] bg-card border-r border-border shadow-xl flex flex-col animate-in slide-in-from-left duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            Table of Contents
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close table of contents"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Chapter list */}
        <nav className="flex-1 overflow-y-auto overscroll-contain py-1">
          {chapters.map((ch) => {
            const isCurrent = ch.index === currentChapterIndex;
            const isBookmarked = bookmarkedChapterIndices.has(ch.index);
            const readingMinutes = ch.wordCount > 0 ? estimateReadingMinutes(ch.wordCount) : 0;
            return (
              <Link
                key={ch.index}
                ref={isCurrent ? activeChapterRef : undefined}
                href={`/novels/${novelId}/read/${ch.index}`}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isCurrent
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    : "text-foreground hover:bg-muted/50 border-l-2 border-transparent"
                }`}
                aria-current={isCurrent ? "page" : undefined}
              >
                <span
                  className={`tabular-nums w-7 text-right shrink-0 ${
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {ch.index}
                </span>
                <span className="truncate flex-1">{ch.title}</span>
                {readingMinutes > 0 && (
                  <span
                    className={`text-[10px] tabular-nums whitespace-nowrap shrink-0 ${
                      isCurrent ? "text-primary/60" : "text-muted-foreground/50"
                    }`}
                    title={`~${readingMinutes} min read`}
                  >
                    {readingMinutes}m
                  </span>
                )}
                {isBookmarked && (
                  <Bookmark
                    className={`h-3.5 w-3.5 shrink-0 fill-current ${
                      isCurrent ? "text-primary" : "text-muted-foreground/60"
                    }`}
                    aria-label="Bookmarked"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1 text-xs font-mono">
              C
            </kbd>{" "}
            or{" "}
            <kbd className="rounded border border-border bg-muted px-1 text-xs font-mono">
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </div>
  );
}
