"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TranslationJob = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  updatedAt: string;
};

type ChapterStatus = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
  completedAt?: string;
};

type SnapshotEventData = {
  job: TranslationJob & Record<string, unknown>;
  chapterStatuses?: ChapterStatus[];
};

type ChapterTranslatedEventData = {
  type: "chapter-translated";
  translationId: string;
  chapterStatus: {
    chapterIndex: number;
    status: "translated";
    completedAt: string;
  };
  job: TranslationJob & Record<string, unknown>;
};

const POLL_INTERVAL_MS = 30_000;
const HANGING_THRESHOLD_MS = 600_000; // 10 minutes

// EventSource readyState value that means the connection is permanently closed.
// CONNECTING=0, OPEN=1, CLOSED=2 per the EventSource spec.
const SSE_CLOSED = 2;

function isActiveStatus(status: TranslationJob["status"]) {
  return status === "PENDING" || status === "IN_PROGRESS";
}

/**
 * SSE-first translation hook.
 *
 * Connects to `/api/translation/jobs/${job.id}/stream` via EventSource and
 * applies live `snapshot` and `chapter-translated` events. Falls back to
 * 30-second status polling only when the SSE connection is confirmed closed
 * (readyState === CLOSED), not while the browser is still attempting to reconnect.
 *
 * Contract: mirrors `useTranslationPolling` return value, adding `sseConnected`.
 */
export function useTranslationSSE<T extends TranslationJob>(
  job: T | null,
  onUpdate: (updater: (prev: T | null) => T | null) => void,
  initialChapterStatuses: ChapterStatus[]
): {
  sseConnected: boolean;
  isHanging: boolean;
  hangingChapterIndex: number | null;
  chapterStatuses: ChapterStatus[];
} {
  const jobRef = useRef(job);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const lastUpdatedAtChangedRef = useRef<number>(0);

  // Guards fallback polling — set true when readyState transitions to CLOSED,
  // cleared on reconnect (open). This prevents polling from activating while the
  // browser's built-in reconnect is still in progress.
  const sseClosedRef = useRef(false);

  const [sseConnected, setSseConnected] = useState(false);
  const [isHanging, setIsHanging] = useState(false);
  const [hangingChapterIndex, setHangingChapterIndex] = useState<number | null>(null);

  // Accumulator ref for chapter statuses — updated on every event to avoid
  // excessive React state churn. Synced to React state for the return value.
  const chapterStatusesMapRef = useRef<Map<number, ChapterStatus>>(
    new Map(initialChapterStatuses.map((s) => [s.chapterIndex, s]))
  );
  const [chapterStatuses, setChapterStatuses] = useState<ChapterStatus[]>(initialChapterStatuses);

  const isActive = job !== null && isActiveStatus(job.status);
  const jobId = job?.id ?? null;

  // Keep job ref in sync
  useEffect(() => {
    jobRef.current = job;
  });

  // Establish a real-time baseline after mount to avoid hanging false
  // positives while still keeping render pure.
  useEffect(() => {
    lastUpdatedAtChangedRef.current = Date.now();
  }, []);

  // Reset when job becomes inactive
  useEffect(() => {
    if (!isActive) {
      lastUpdatedAtRef.current = null;
      lastUpdatedAtChangedRef.current = Date.now();
    }
  }, [isActive]);

  const onUpdateStable = useCallback(
    (updater: (prev: T | null) => T | null) => onUpdate(updater),
    [onUpdate]
  );

  useEffect(() => {
    if (!isActive || !jobId) return;

    // ── SSE connection ────────────────────────────────────────────────────────

    const eventSource = new EventSource(`/api/translation/jobs/${jobId}/stream`);
    let sseActive = true;

    function applySnapshot(data: SnapshotEventData) {
      const updatedJob = data.job as TranslationJob & Record<string, unknown>;

      // Update chapter statuses
      if (Array.isArray(data.chapterStatuses)) {
        for (const s of data.chapterStatuses) {
          chapterStatusesMapRef.current.set(s.chapterIndex, s);
        }
        setChapterStatuses(
          Array.from(chapterStatusesMapRef.current.values()).sort(
            (a, b) => a.chapterIndex - b.chapterIndex
          )
        );
      }

      // Update job via onUpdate — only if newer
      onUpdateStable((prev) => {
        if (!prev || prev.id !== updatedJob.id) return prev;
        if (
          new Date(updatedJob.updatedAt) <=
          new Date(prev.updatedAt)
        )
          return prev;
        return { ...prev, ...updatedJob } as T;
      });

      // Hanging detection
      const now = Date.now();
      if (lastUpdatedAtRef.current !== updatedJob.updatedAt) {
        lastUpdatedAtRef.current = updatedJob.updatedAt;
        lastUpdatedAtChangedRef.current = now;
        setIsHanging(false);
        setHangingChapterIndex(null);
      }
    }

    function applyChapterTranslated(data: ChapterTranslatedEventData) {
      const { chapterStatus, job: updatedJob } = data;

      // Only process "translated" final state
      if (chapterStatus.status !== "translated") return;

      chapterStatusesMapRef.current.set(chapterStatus.chapterIndex, {
        chapterIndex: chapterStatus.chapterIndex,
        status: "translated",
        completedAt: chapterStatus.completedAt,
      });
      setChapterStatuses(
        Array.from(chapterStatusesMapRef.current.values()).sort(
          (a, b) => a.chapterIndex - b.chapterIndex
        )
      );

      // Update job via onUpdate
      onUpdateStable((prev) => {
        if (!prev || prev.id !== updatedJob.id) return prev;
        return { ...prev, ...updatedJob } as T;
      });

      // Hanging detection
      const now = Date.now();
      if (lastUpdatedAtRef.current !== updatedJob.updatedAt) {
        lastUpdatedAtRef.current = updatedJob.updatedAt;
        lastUpdatedAtChangedRef.current = now;
        setIsHanging(false);
        setHangingChapterIndex(null);
      }
    }

    eventSource.addEventListener("snapshot", (e: MessageEvent) => {
      if (!sseActive) return;
      try {
        const data = JSON.parse(e.data) as SnapshotEventData;
        if (!data || typeof data !== "object") return;
        applySnapshot(data);
      } catch {
        // Malformed JSON — ignore and keep connection alive
      }
    });

    eventSource.addEventListener("chapter-translated", (e: MessageEvent) => {
      if (!sseActive) return;
      try {
        const data = JSON.parse(e.data) as ChapterTranslatedEventData;
        if (!data || typeof data !== "object") return;
        if (data.type !== "chapter-translated") return;
        if (typeof data.chapterStatus?.completedAt !== "string") return;
        applyChapterTranslated(data);
      } catch {
        // Malformed JSON — ignore and keep connection alive
      }
    });

    eventSource.onopen = () => {
      if (!sseActive) return;
      // Reconnected — clear the closed flag and stop any fallback polling.
      sseClosedRef.current = false;
      setSseConnected(true);
      if (pollIntervalId !== null) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    };

    eventSource.onerror = () => {
      // onerror fires on transient errors during browser reconnect attempts too.
      // Only treat as truly closed when readyState explicitly transitions to CLOSED.
      // This prevents fallback polling from activating while the browser is still
      // attempting reconnection. The server-sent retry: directive guides the browser.
      if (eventSource.readyState === SSE_CLOSED) {
        sseClosedRef.current = true;
        setSseConnected(false);
        // Browser stopped reconnecting — resume fallback polling immediately.
        if (sseActive && document.visibilityState !== "hidden") {
          startPolling();
        }
      }
    };

    // ── Fallback polling (only when SSE is confirmed closed) ──────────────────

    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

    /**
     * Start 30-second fallback polling. Guarded against double-start and
     * re-entrant calls — returns immediately if already polling or if SSE
     * has since reconnected.
     */
    function startPolling() {
      if (pollIntervalId !== null) return; // Already polling
      pollIntervalId = setInterval(async () => {
        const current = jobRef.current;
        if (!current || !isActiveStatus(current.status)) {
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
          }
          return;
        }
        // Only poll if SSE is confirmed closed — reconnect/open clears sseClosedRef.
        if (!sseClosedRef.current) {
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
          }
          return;
        }
        try {
          const res = await fetch(`/api/translation/jobs/${current.id}/status`);
          if (!res.ok) return;
          const data = (await res.json()) as {
            job: TranslationJob & Record<string, unknown>;
            chapterStatuses?: ChapterStatus[];
          };

          if (Array.isArray(data.chapterStatuses)) {
            for (const s of data.chapterStatuses) {
              chapterStatusesMapRef.current.set(s.chapterIndex, s);
            }
            setChapterStatuses(
              Array.from(chapterStatusesMapRef.current.values()).sort(
                (a, b) => a.chapterIndex - b.chapterIndex
              )
            );
          }

          onUpdateStable((prev) => {
            if (!prev || prev.id !== data.job.id) return prev;
            if (new Date(data.job.updatedAt) <= new Date(prev.updatedAt)) return prev;
            return { ...prev, ...data.job } as T;
          });

          // Hanging detection
          const now = Date.now();
          if (lastUpdatedAtRef.current !== data.job.updatedAt) {
            lastUpdatedAtRef.current = data.job.updatedAt;
            lastUpdatedAtChangedRef.current = now;
            setIsHanging(false);
            setHangingChapterIndex(null);
          } else {
            const elapsed = now - lastUpdatedAtChangedRef.current;
            if (elapsed >= HANGING_THRESHOLD_MS && isActiveStatus(data.job.status)) {
              setIsHanging(true);
              const completedChapters = data.job.completedChapters as number | undefined;
              if (typeof completedChapters === "number") {
                setHangingChapterIndex(completedChapters + 1);
              }
            }
          }
        } catch {
          // Network error — skip this poll cycle, preserve last known state
        }
      }, POLL_INTERVAL_MS);
    }

    // Start polling fallback after 5 seconds if SSE hasn't connected yet.
    // Even if SSE connected during the wait window, this starts the fallback
    // guard — onerror/onopen will clear it if the stream is still alive.
    pollTimeoutId = setTimeout(() => {
      if (!sseActive) return;
      startPolling();
    }, 5_000);

    // ── Visibility handling ────────────────────────────────────────────────────

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
      } else {
        // Tab became visible — restart polling only if SSE is still closed.
        if (sseClosedRef.current) {
          startPolling();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ── Cleanup ────────────────────────────────────────────────────────────────

    return () => {
      sseActive = false;
      eventSource.close();
      sseClosedRef.current = true;
      setSseConnected(false);
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, jobId, onUpdateStable]);

  // ── Hanging timer (active regardless of SSE/polling) ──────────────────────
  // Check every 30 seconds whether updatedAt has stalled
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      const elapsed = Date.now() - lastUpdatedAtChangedRef.current;
      if (elapsed >= HANGING_THRESHOLD_MS) {
        setIsHanging(true);
        const completed = (jobRef.current as Record<string, unknown> | null)?.completedChapters;
        if (typeof completed === "number") {
          setHangingChapterIndex(completed + 1);
        }
      }
    }, 30_000);

    return () => clearInterval(timer);
  }, [isActive]);

  return {
    sseConnected: isActive ? sseConnected : false,
    isHanging: isActive ? isHanging : false,
    hangingChapterIndex: isActive ? hangingChapterIndex : null,
    chapterStatuses: isActive ? chapterStatuses : initialChapterStatuses,
  };
}
