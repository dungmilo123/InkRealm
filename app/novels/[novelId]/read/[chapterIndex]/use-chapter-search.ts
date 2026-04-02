"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  findMatches,
  nextMatchIndex,
  prevMatchIndex,
  type SearchMatch,
} from "@/lib/chapter-search";

type UseChapterSearchOptions = {
  paragraphs: string[];
};

type UseChapterSearchReturn = {
  /** Whether the search bar is currently visible */
  isOpen: boolean;
  /** The current search query */
  query: string;
  /** All matches in the current chapter */
  matches: SearchMatch[];
  /** Index of the currently active/focused match (-1 if none) */
  activeMatchIndex: number;
  /** Open the search bar and focus the input */
  open: () => void;
  /** Close the search bar and clear highlights */
  close: () => void;
  /** Toggle the search bar */
  toggle: () => void;
  /** Update the search query */
  setQuery: (q: string) => void;
  /** Jump to the next match */
  goToNext: () => void;
  /** Jump to the previous match */
  goToPrev: () => void;
};

export function useChapterSearch({
  paragraphs,
}: UseChapterSearchOptions): UseChapterSearchReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);

  // Debounce the actual search to avoid lag on fast typing
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(q);
    }, 150);
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const matches = useMemo(
    () => findMatches(paragraphs, debouncedQuery),
    [paragraphs, debouncedQuery]
  );

  // Reset active match index when matches change.
  // requestAnimationFrame moves the setState out of the synchronous effect
  // body, satisfying React 19's react-hooks/set-state-in-effect rule.
  const matchCount = matches.length;
  useEffect(() => {
    const newIndex = matchCount > 0 ? 0 : -1;
    const raf = requestAnimationFrame(() => {
      setActiveMatchIndex(newIndex);
    });
    return () => cancelAnimationFrame(raf);
  }, [matchCount, debouncedQuery]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState("");
    setDebouncedQuery("");
    setActiveMatchIndex(-1);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        // Closing — clear search state
        setQueryState("");
        setDebouncedQuery("");
        setActiveMatchIndex(-1);
      }
      return !prev;
    });
  }, []);

  const goToNext = useCallback(() => {
    setActiveMatchIndex((current) => nextMatchIndex(current, matches.length));
  }, [matches.length]);

  const goToPrev = useCallback(() => {
    setActiveMatchIndex((current) => prevMatchIndex(current, matches.length));
  }, [matches.length]);

  return {
    isOpen,
    query,
    matches,
    activeMatchIndex,
    open,
    close,
    toggle,
    setQuery,
    goToNext,
    goToPrev,
  };
}
