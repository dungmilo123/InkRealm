"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { NovelSearchResult } from "@/lib/novel-search";

type UseNovelSearchOptions = {
  novelId: string;
  /** Whether the novel search dialog is currently open — triggers/gates search */
  isOpen: boolean;
};

type UseNovelSearchReturn = {
  /** The current query string shown in the input */
  query: string;
  /** Update the query — search is debounced automatically */
  setQuery: (q: string) => void;
  /** The latest search results (null until first successful search) */
  results: NovelSearchResult | null;
  /** Whether a search request is currently in flight */
  isLoading: boolean;
  /** Error message from the last failed request (null on success) */
  error: string | null;
  /** Clear all search state (query, results, error) */
  clear: () => void;
};

/** Debounce delay in ms — longer than in-chapter search (150ms) since this
 *  hits a server API with file I/O + cross-chapter scanning. */
const DEBOUNCE_MS = 300;

/** Minimum query length before triggering an API call (matches server validation) */
const MIN_QUERY_LENGTH = 2;

/**
 * Manages cross-chapter novel search with debounced API calls.
 *
 * - Input → 300ms debounce → GET /api/novels/[novelId]/search?q=X
 * - AbortController cancels in-flight requests when query changes
 * - Clears results immediately when query drops below min length
 * - Resets all state when dialog closes
 *
 * Follows the same lifecycle pattern as useBookmarkPanel (lazy fetch on open,
 * cleanup on close) but with debounce + abort for search-as-you-type UX.
 */
export function useNovelSearch({
  novelId,
  isOpen,
}: UseNovelSearchOptions): UseNovelSearchReturn {
  const [query, setQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<NovelSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Monotonically increasing counter to discard stale responses */
  const generationRef = useRef(0);

  // Debounce query updates
  const setQuery = useCallback((q: string) => {
    setQueryState(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // If query is too short, clear immediately (no debounce wait)
    if (q.trim().length < MIN_QUERY_LENGTH) {
      setDebouncedQuery("");
      setResults(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(q.trim());
    }, DEBOUNCE_MS);
  }, []);

  // Fetch search results when debouncedQuery changes
  useEffect(() => {
    if (!isOpen || debouncedQuery.length < MIN_QUERY_LENGTH) return;

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    const currentGeneration = ++generationRef.current;

    // Set loading state via queueMicrotask (React 19 set-state-in-effect rule)
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true);
        setError(null);
      }
    });

    const url = `/api/novels/${encodeURIComponent(novelId)}/search?q=${encodeURIComponent(debouncedQuery)}`;

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { results: NovelSearchResult };

        // Only apply if this is still the latest request
        if (currentGeneration === generationRef.current) {
          setResults(data.results);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        // Ignore aborted requests (user typed more or dialog closed)
        if (err instanceof DOMException && err.name === "AbortError") return;

        if (currentGeneration === generationRef.current) {
          setError(
            err instanceof Error ? err.message : "Search failed"
          );
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isOpen, novelId, debouncedQuery]);

  // Reset all state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQueryState("");
      setDebouncedQuery("");
      setResults(null);
      setIsLoading(false);
      setError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [isOpen]);

  // Cleanup timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const clear = useCallback(() => {
    setQueryState("");
    setDebouncedQuery("");
    setResults(null);
    setIsLoading(false);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clear,
  };
}
