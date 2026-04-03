"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, BookOpen, X } from "lucide-react";
import { useNovelSearch } from "./use-novel-search";
import type { NovelSearchResult, ChapterSearchResult } from "@/lib/novel-search";

type NovelSearchDialogProps = {
  novelId: string;
  currentChapterIndex: number;
  chapterCount: number;
  onClose: () => void;
};

/**
 * Cross-chapter novel search dialog.
 *
 * Triggered by Shift+F. Lets users search the entire novel text across all
 * chapters, showing results grouped by chapter with context snippets.
 *
 * Uses the `useNovelSearch` hook for debounced API calls with AbortController
 * cancellation. Results link to the relevant chapter in the reader.
 *
 * Design: centered modal (same pattern as GoToChapterDialog), optimized for
 * "type query → scan grouped results → click to navigate".
 */
export function NovelSearchDialog({
  novelId,
  currentChapterIndex,
  chapterCount,
  onClose,
}: NovelSearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, results, isLoading, error } = useNovelSearch({
    novelId,
    isOpen: true,
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const navigateToChapter = useCallback(
    (chapterIndex: number) => {
      router.push(`/novels/${novelId}/read/${chapterIndex}`);
      onClose();
    },
    [router, novelId, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Search in novel"
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl overflow-hidden flex flex-col"
        style={{ maxHeight: "70vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          {isLoading ? (
            <Loader2
              className="h-4 w-4 text-muted-foreground animate-spin shrink-0"
              aria-hidden="true"
            />
          ) : (
            <Search
              className="h-4 w-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all chapters..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            aria-label="Search across all chapters"
            autoComplete="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results summary bar */}
        {results && results.totalMatches > 0 && (
          <div className="px-4 py-1.5 border-b border-border bg-muted/30 shrink-0">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {results.totalMatches.toLocaleString()} match{results.totalMatches !== 1 ? "es" : ""} in{" "}
              {results.chaptersWithMatches} chapter{results.chaptersWithMatches !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Scrollable results area */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto"
        >
          <SearchResults
            results={results}
            isLoading={isLoading}
            error={error}
            query={query}
            currentChapterIndex={currentChapterIndex}
            chapterCount={chapterCount}
            onNavigate={navigateToChapter}
          />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 shrink-0">
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
              Enter
            </kbd>
            {" "}in a result to jump{" "}
            <span className="mx-1">·</span>
            Min 2 characters to search{" "}
            <span className="mx-1">·</span>
            Searches all {chapterCount} chapters
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Internal sub-components ---

function SearchResults({
  results,
  isLoading,
  error,
  query,
  currentChapterIndex,
  chapterCount,
  onNavigate,
}: {
  results: NovelSearchResult | null;
  isLoading: boolean;
  error: string | null;
  query: string;
  currentChapterIndex: number;
  chapterCount: number;
  onNavigate: (chapterIndex: number) => void;
}) {
  // Error state
  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try a different search term
        </p>
      </div>
    );
  }

  // Initial empty state (no query yet)
  if (!query.trim() || query.trim().length < 2) {
    return (
      <div className="px-4 py-8 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Search across all {chapterCount} chapters
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Type at least 2 characters to search
        </p>
      </div>
    );
  }

  // Loading state (query pending, no results yet)
  if (isLoading && !results) {
    return (
      <div className="px-4 py-8 text-center">
        <Loader2
          className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2 animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          Searching...
        </p>
      </div>
    );
  }

  // No results
  if (results && results.totalMatches === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No matches found for &ldquo;{results.query}&rdquo;
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Try a different search term or shorter query
        </p>
      </div>
    );
  }

  // Results grouped by chapter
  if (results && results.chapters.length > 0) {
    return (
      <div className="py-1">
        {results.chapters.map((chapter) => (
          <ChapterResultGroup
            key={chapter.chapterIndex}
            chapter={chapter}
            isCurrent={chapter.chapterIndex === currentChapterIndex}
            searchQuery={results.query}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return null;
}

function ChapterResultGroup({
  chapter,
  isCurrent,
  searchQuery,
  onNavigate,
}: {
  chapter: ChapterSearchResult;
  isCurrent: boolean;
  searchQuery: string;
  onNavigate: (chapterIndex: number) => void;
}) {
  return (
    <div className="border-b border-border/50 last:border-b-0">
      {/* Chapter header — clickable to navigate */}
      <button
        type="button"
        onClick={() => onNavigate(chapter.chapterIndex)}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors group"
      >
        <span
          className={`shrink-0 w-7 text-right tabular-nums text-xs ${
            isCurrent
              ? "text-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          {chapter.chapterIndex}
        </span>
        <span className="flex-1 text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {chapter.chapterTitle}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {chapter.totalMatches} match{chapter.totalMatches !== 1 ? "es" : ""}
        </span>
        {isCurrent && (
          <span className="shrink-0 text-[10px] text-primary font-medium uppercase tracking-wider">
            Current
          </span>
        )}
      </button>

      {/* Match snippets */}
      {chapter.matches.length > 0 && (
        <div className="pl-14 pr-4 pb-2 space-y-1">
          {chapter.matches.map((match, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(chapter.chapterIndex)}
              className="block w-full text-left text-xs text-muted-foreground leading-relaxed hover:text-foreground transition-colors py-0.5"
            >
              <HighlightedSnippet
                snippet={match.snippet}
                query={searchQuery}
              />
            </button>
          ))}
          {chapter.totalMatches > chapter.matches.length && (
            <p className="text-[11px] text-muted-foreground/60 italic">
              +{chapter.totalMatches - chapter.matches.length} more match{chapter.totalMatches - chapter.matches.length !== 1 ? "es" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a search snippet with the matched query text highlighted.
 * Case-insensitive highlighting to match the search behavior.
 */
function HighlightedSnippet({
  snippet,
  query,
}: {
  snippet: string;
  query: string;
}) {
  if (!query) return <span>{snippet}</span>;

  const parts: { text: string; isMatch: boolean }[] = [];
  const lowerSnippet = snippet.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let searchFrom = 0;
  while (searchFrom <= lowerSnippet.length - lowerQuery.length) {
    const idx = lowerSnippet.indexOf(lowerQuery, searchFrom);
    if (idx === -1) break;

    // Text before match
    if (idx > lastIndex) {
      parts.push({ text: snippet.slice(lastIndex, idx), isMatch: false });
    }
    // Matched text
    parts.push({
      text: snippet.slice(idx, idx + query.length),
      isMatch: true,
    });

    lastIndex = idx + query.length;
    searchFrom = idx + 1;
  }

  // Remaining text after last match
  if (lastIndex < snippet.length) {
    parts.push({ text: snippet.slice(lastIndex), isMatch: false });
  }

  return (
    <span>
      {parts.map((part, i) =>
        part.isMatch ? (
          <mark
            key={i}
            className="bg-primary/20 text-foreground rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}
