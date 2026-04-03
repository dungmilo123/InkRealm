"use client";

import { useState, useCallback, useRef } from "react";

type UseBookmarkOptions = {
  novelId: string;
  chapterIndex: number;
  /** Server-fetched initial state — avoids a loading flash */
  initialBookmarked: boolean;
};

type UseBookmarkReturn = {
  /** Whether this chapter is currently bookmarked */
  isBookmarked: boolean;
  /** Whether a toggle request is in flight */
  isPending: boolean;
  /** Toggle the bookmark on/off. Safe to call rapidly (debounced). */
  toggle: () => void;
};

/**
 * Manages bookmark state for the current chapter with optimistic updates.
 *
 * Uses the toggle-API semantic from POST /api/reading/bookmarks:
 * one call creates or removes the bookmark depending on current state.
 *
 * Optimistic: the icon flips instantly; if the API call fails, it rolls back.
 */
export function useBookmark({
  novelId,
  chapterIndex,
  initialBookmarked,
}: UseBookmarkOptions): UseBookmarkReturn {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isPending, setIsPending] = useState(false);

  // Prevent concurrent toggles from racing
  const inflightRef = useRef(false);

  const toggle = useCallback(() => {
    if (inflightRef.current) return;
    inflightRef.current = true;

    // Optimistic flip
    const previous = isBookmarked;
    setIsBookmarked(!previous);
    setIsPending(true);

    fetch("/api/reading/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novelId, chapterIndex }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Server confirmed — state already matches
      })
      .catch(() => {
        // Rollback on failure
        setIsBookmarked(previous);
      })
      .finally(() => {
        setIsPending(false);
        inflightRef.current = false;
      });
  }, [isBookmarked, novelId, chapterIndex]);

  return { isBookmarked, isPending, toggle };
}
