"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PollingJob = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  updatedAt: string;
};

type JobStatusResponse = {
  job: PollingJob & Record<string, unknown>;
  chapterStatuses?: Array<{ chapterIndex: number; status: "translated" | "translating" | "untranslated" }>;
};

const POLL_INTERVAL_MS = 3_000;
const HANGING_THRESHOLD_MS = 600_000; // 10 minutes

function isActiveStatus(status: PollingJob["status"]) {
  return status === "PENDING" || status === "IN_PROGRESS";
}

export function useTranslationPolling<T extends PollingJob>(
  job: T | null,
  onUpdate: (updater: (prev: T | null) => T | null) => void
): {
  isHanging: boolean;
  hangingChapterIndex: number | null;
  chapterStatuses: Array<{ chapterIndex: number; status: "translated" | "translating" | "untranslated" }>;
} {
  const jobRef = useRef(job);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const lastUpdatedAtChangedRef = useRef<number>(Date.now());
  const [isHanging, setIsHanging] = useState(false);
  const [hangingChapterIndex, setHangingChapterIndex] = useState<number | null>(null);
  const [chapterStatuses, setChapterStatuses] = useState<
    Array<{ chapterIndex: number; status: "translated" | "translating" | "untranslated" }>
  >([]);

  const isActive = job !== null && isActiveStatus(job.status);

  useEffect(() => {
    jobRef.current = job;
  });

  // Reset hanging state when job changes or becomes inactive
  useEffect(() => {
    if (!isActive) {
      setIsHanging(false);
      setHangingChapterIndex(null);
      setChapterStatuses([]);
      lastUpdatedAtRef.current = null;
    }
  }, [isActive]);

  const onUpdateStable = useCallback(onUpdate, [onUpdate]);

  useEffect(() => {
    if (!isActive || !job) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function pollJob() {
      const current = jobRef.current;
      if (!current || !isActiveStatus(current.status)) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      try {
        const res = await fetch(`/api/translation/jobs/${current.id}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as JobStatusResponse;
        const updated = data.job;

        if (Array.isArray(data.chapterStatuses)) {
          setChapterStatuses(data.chapterStatuses);
        }

        onUpdateStable((prev) => {
          if (!prev || prev.id !== updated.id) return prev;
          // Only apply if newer
          if (new Date(updated.updatedAt) <= new Date(prev.updatedAt)) return prev;
          return { ...prev, ...updated } as T;
        });

        // Check for hanging detection
        const now = Date.now();
        if (lastUpdatedAtRef.current !== updated.updatedAt) {
          // updatedAt changed — reset timer
          lastUpdatedAtRef.current = updated.updatedAt;
          lastUpdatedAtChangedRef.current = now;
          setIsHanging(false);
          setHangingChapterIndex(null);
        } else {
          // updatedAt hasn't changed — check if past threshold
          const elapsed = now - lastUpdatedAtChangedRef.current;
          if (elapsed >= HANGING_THRESHOLD_MS && isActiveStatus(updated.status)) {
            setIsHanging(true);
            // Extract completedChapters to infer hanging chapter
            const completedChapters = (updated as Record<string, unknown>).completedChapters;
            if (typeof completedChapters === "number") {
              setHangingChapterIndex(completedChapters + 1);
            }
          }
        }
      } catch {
        // Network error — skip this poll cycle
      }
    }

    // Initialize tracking
    if (job) {
      lastUpdatedAtRef.current = job.updatedAt;
      lastUpdatedAtChangedRef.current = Date.now();
    }

    // Initial poll
    void pollJob();
    intervalId = setInterval(() => void pollJob(), POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        // Tab became visible — immediate fetch + restart interval
        void pollJob();
        if (!intervalId) {
          intervalId = setInterval(() => void pollJob(), POLL_INTERVAL_MS);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, job, onUpdateStable]);

  return { isHanging, hangingChapterIndex, chapterStatuses };
}
