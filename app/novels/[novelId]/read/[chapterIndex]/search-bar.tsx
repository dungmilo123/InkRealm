"use client";

import { useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { formatMatchPosition } from "@/lib/chapter-search";

type SearchBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  totalMatches: number;
  activeMatchIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
};

export function SearchBar({
  query,
  onQueryChange,
  totalMatches,
  activeMatchIndex,
  onNext,
  onPrev,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the search bar appears
  useEffect(() => {
    // Small delay to allow animation to start
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard events within the search input
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  }

  const positionLabel = formatMatchPosition(activeMatchIndex, totalMatches);
  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && totalMatches === 0;

  return (
    <div className="fixed top-2 right-4 z-[60] flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 shadow-lg animate-in slide-in-from-top-2 duration-200">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search in chapter..."
        aria-label="Search in chapter"
        className={`h-7 w-48 rounded-md border bg-background px-2 text-sm outline-none transition-colors focus:ring-1 focus:ring-primary ${
          noResults
            ? "border-destructive/50 text-destructive"
            : "border-input text-foreground"
        }`}
      />

      {hasQuery && (
        <span
          className={`text-xs tabular-nums min-w-[4rem] text-center ${
            noResults ? "text-destructive" : "text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {noResults ? "No results" : positionLabel}
        </span>
      )}

      <div className="flex items-center">
        <button
          type="button"
          onClick={onPrev}
          disabled={totalMatches === 0}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={totalMatches === 0}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Next match"
          title="Next match (Enter)"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Close search"
        title="Close search (Escape)"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
