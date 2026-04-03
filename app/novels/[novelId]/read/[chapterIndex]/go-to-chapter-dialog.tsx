"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

type GoToChapterDialogProps = {
  novelId: string;
  chapters: { index: number; title: string }[];
  currentChapterIndex: number;
  chapterCount: number;
  onClose: () => void;
};

/**
 * Lightweight "Go to Chapter" dialog for quick chapter navigation.
 *
 * Triggered by the `G` keyboard shortcut. Supports two modes:
 * 1. **Number input**: type a chapter number, hit Enter to jump
 * 2. **Title search**: type text to fuzzy-filter chapter titles, arrow-select, Enter to jump
 *
 * Design: small centered modal (not a full drawer) — optimized for "I know where I want to go".
 */
export function GoToChapterDialog({
  novelId,
  chapters,
  currentChapterIndex,
  chapterCount,
  onClose,
}: GoToChapterDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter chapters: if query is a pure number, show only that chapter;
  // otherwise fuzzy-match against chapter titles
  const filteredChapters = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed === "") return chapters;

    // Pure number → match chapter index
    const asNumber = parseInt(trimmed, 10);
    if (!isNaN(asNumber) && String(asNumber) === trimmed) {
      return chapters.filter((ch) => ch.index === asNumber);
    }

    // Text → case-insensitive title search
    const lower = trimmed.toLowerCase();
    return chapters.filter(
      (ch) =>
        ch.title.toLowerCase().includes(lower) ||
        `chapter ${ch.index}`.includes(lower)
    );
  }, [query, chapters]);

  // Reset selection when filter changes
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedIndex(filteredChapters.length > 0 ? 0 : -1);
    });
  }, [filteredChapters]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const navigateToChapter = useCallback(
    (chapterIndex: number) => {
      if (chapterIndex >= 1 && chapterIndex <= chapterCount) {
        router.push(`/novels/${novelId}/read/${chapterIndex}`);
        onClose();
      }
    },
    [router, novelId, chapterCount, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;

        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredChapters.length - 1 ? prev + 1 : prev
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case "Enter": {
          e.preventDefault();
          const trimmed = query.trim();

          // If the query is a pure number, navigate directly to that chapter
          const asNumber = parseInt(trimmed, 10);
          if (!isNaN(asNumber) && String(asNumber) === trimmed) {
            navigateToChapter(asNumber);
            return;
          }

          // Otherwise navigate to the selected filtered result
          if (selectedIndex >= 0 && selectedIndex < filteredChapters.length) {
            navigateToChapter(filteredChapters[selectedIndex].index);
          }
          break;
        }
      }
    },
    [onClose, query, selectedIndex, filteredChapters, navigateToChapter]
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Go to chapter"
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-sm text-muted-foreground shrink-0">Go to</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Chapter number or title (1–${chapterCount})`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            aria-label="Chapter number or title"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto py-1"
          role="listbox"
          aria-label="Chapters"
        >
          {filteredChapters.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No matching chapters
            </p>
          ) : (
            filteredChapters.map((ch, i) => {
              const isCurrent = ch.index === currentChapterIndex;
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={ch.index}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => navigateToChapter(ch.index)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-8 text-right tabular-nums text-xs ${
                      isCurrent
                        ? "text-primary font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {ch.index}
                  </span>
                  <span className="flex-1 truncate">
                    {ch.title}
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 text-[10px] text-primary font-medium uppercase tracking-wider">
                      Current
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              Enter
            </kbd>
            {" "}to jump{" "}
            <span className="mx-1">·</span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              ↑↓
            </kbd>
            {" "}to select{" "}
            <span className="mx-1">·</span>
            Type a number or search by title
          </p>
        </div>
      </div>
    </div>
  );
}
