"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type ScrollPositionOptions = {
  novelId: string;
  chapterIndex: number;
  /** Debounce interval for saving scroll position (ms). Default: 500 */
  saveInterval?: number;
};

type ScrollState = {
  /** Current scroll progress 0–1 */
  progress: number;
  /** Whether the initial position has been restored */
  restored: boolean;
};

/**
 * Generates a localStorage key for scroll position of a specific chapter.
 */
function storageKey(novelId: string, chapterIndex: number): string {
  return `inkrealm:scroll:${novelId}:${chapterIndex}`;
}

/**
 * Calculates the current scroll progress as a 0–1 ratio.
 */
function getScrollProgress(): number {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight;
  const viewHeight = window.innerHeight;
  const scrollable = docHeight - viewHeight;

  if (scrollable <= 0) return 1; // Content fits in viewport
  return Math.min(1, Math.max(0, scrollTop / scrollable));
}

/**
 * Hook that tracks and persists the reader's scroll position.
 *
 * Strategy:
 * 1. On mount: restore from localStorage (instant, no flicker)
 * 2. On scroll: save to localStorage immediately + debounce server save
 * 3. On unmount/beforeunload: flush pending server save
 *
 * localStorage provides instant restore for same-device returns.
 * Server persistence enables cross-device resume.
 */
export function useScrollPosition({
  novelId,
  chapterIndex,
  saveInterval = 500,
}: ScrollPositionOptions): ScrollState {
  const [progress, setProgress] = useState(0);
  const [restored, setRestored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<number>(-1);

  // Save to server (fire-and-forget)
  const saveToServer = useCallback(
    (position: number) => {
      // Don't save if effectively unchanged (within 0.5% tolerance)
      if (Math.abs(position - lastSavedRef.current) < 0.005) return;
      lastSavedRef.current = position;

      void fetch("/api/reading/scroll-position", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId, chapterIndex, scrollPosition: position }),
      });
    },
    [novelId, chapterIndex]
  );

  // Restore scroll position on mount
  useEffect(() => {
    const key = storageKey(novelId, chapterIndex);
    const saved = localStorage.getItem(key);

    if (saved !== null) {
      const position = parseFloat(saved);
      if (Number.isFinite(position) && position > 0.01) {
        // Delay restore to ensure content has rendered
        requestAnimationFrame(() => {
          const docHeight = document.documentElement.scrollHeight;
          const viewHeight = window.innerHeight;
          const scrollable = docHeight - viewHeight;

          if (scrollable > 0) {
            window.scrollTo({ top: position * scrollable, behavior: "instant" });
            setProgress(position);
          }
          setRestored(true);
        });
        return;
      }
    }

    // No saved position — mark restored via rAF to satisfy react-hooks/set-state-in-effect
    requestAnimationFrame(() => {
      setRestored(true);
    });
  }, [novelId, chapterIndex]);

  // Track scroll position
  useEffect(() => {
    const key = storageKey(novelId, chapterIndex);

    function handleScroll() {
      const currentProgress = getScrollProgress();
      setProgress(currentProgress);

      // Save to localStorage immediately (cheap)
      localStorage.setItem(key, currentProgress.toFixed(4));

      // Debounce server save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveToServer(currentProgress);
      }, saveInterval);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      // Flush pending save on cleanup
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        const finalProgress = getScrollProgress();
        saveToServer(finalProgress);
      }
    };
  }, [novelId, chapterIndex, saveInterval, saveToServer]);

  // Also save on beforeunload (tab close/refresh)
  useEffect(() => {
    function handleBeforeUnload() {
      const key = storageKey(novelId, chapterIndex);
      const currentProgress = getScrollProgress();
      localStorage.setItem(key, currentProgress.toFixed(4));

      // Use sendBeacon with Blob for reliable delivery during page unload.
      // Blob lets us set Content-Type to application/json (plain string defaults to text/plain).
      const payload = new Blob(
        [JSON.stringify({ novelId, chapterIndex, scrollPosition: currentProgress })],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/reading/scroll-position", payload);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [novelId, chapterIndex]);

  return { progress, restored };
}
