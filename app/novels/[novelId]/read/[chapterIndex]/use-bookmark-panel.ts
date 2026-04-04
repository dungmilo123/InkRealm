"use client";

import { useState, useCallback, useEffect } from "react";

type BookmarkEntry = {
  id: string;
  chapterIndex: number;
  note: string | null;
  createdAt: string;
};

type UseBookmarkPanelOptions = {
  novelId: string;
  /** Whether the panel is currently open — triggers data fetch */
  isOpen: boolean;
};

type UseBookmarkPanelReturn = {
  bookmarks: BookmarkEntry[];
  isLoading: boolean;
  error: string | null;
  /** Update the note on a bookmark. Optimistic — rolls back on failure. */
  updateNote: (bookmarkId: string, note: string | null) => void;
  /** Re-fetch the bookmark list (e.g. after toggling a bookmark) */
  refresh: () => void;
};

/**
 * Manages the bookmark panel's data lifecycle.
 *
 * Fetches the full bookmark list from GET /api/reading/bookmarks?novelId=X
 * when the panel opens, and provides an optimistic note-update function
 * that calls PATCH /api/reading/bookmarks.
 *
 * Fetching only when `isOpen` is true avoids unnecessary DB queries
 * on every chapter load — the panel is a secondary feature.
 */
export function useBookmarkPanel({
  novelId,
  isOpen,
}: UseBookmarkPanelOptions): UseBookmarkPanelReturn {
  // Single state object for fetch lifecycle — avoids multiple setState calls
  const [state, setState] = useState<{
    bookmarks: BookmarkEntry[];
    isLoading: boolean;
    error: string | null;
  }>({ bookmarks: [], isLoading: false, error: null });

  // Increment to invalidate stale fetches; also used to trigger re-fetches
  const [fetchGeneration, setFetchGeneration] = useState(0);

  // Fetch bookmarks when the panel opens or when refresh is called
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    // Start fetch — loading state is set via startTransition-friendly pattern
    // We use a microtask to avoid synchronous setState in effect body
    queueMicrotask(() => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }
    });

    fetch(`/api/reading/bookmarks?novelId=${encodeURIComponent(novelId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ bookmarks: BookmarkEntry[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ bookmarks: data.bookmarks, isLoading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : "Failed to load bookmarks",
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, novelId, fetchGeneration]);

  // Trigger a re-fetch by bumping the generation counter
  const refresh = useCallback(() => {
    setFetchGeneration((g) => g + 1);
  }, []);

  const updateNote = useCallback(
    (bookmarkId: string, note: string | null) => {
      // Optimistic update
      setState((prev) => ({
        ...prev,
        bookmarks: prev.bookmarks.map((b) =>
          b.id === bookmarkId ? { ...b, note } : b
        ),
      }));

      fetch("/api/reading/bookmarks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkId, note }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .catch(() => {
          // Rollback: re-fetch to get fresh data
          refresh();
        });
    },
    [refresh]
  );

  return {
    bookmarks: state.bookmarks,
    isLoading: state.isLoading,
    error: state.error,
    updateNote,
    refresh,
  };
}
