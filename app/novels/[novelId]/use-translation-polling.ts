"use client";

import { useEffect, useRef } from "react";

type PollingJob = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  updatedAt: string;
};

type JobStatusResponse = {
  job: PollingJob & Record<string, unknown>;
};

const POLL_INTERVAL_MS = 3_000;

function isActiveStatus(status: PollingJob["status"]) {
  return status === "PENDING" || status === "IN_PROGRESS";
}

export function useTranslationPolling<T extends PollingJob>(
  jobs: T[],
  onUpdate: (updater: (prev: T[]) => T[]) => void
) {
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const hasActiveJobs = jobs.some((j) => isActiveStatus(j.status));

  useEffect(() => {
    if (!hasActiveJobs) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function pollActiveJobs() {
      const current = jobsRef.current;
      const active = current.filter((j) => isActiveStatus(j.status));
      if (active.length === 0) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      const results = await Promise.allSettled(
        active.map(async (j) => {
          const res = await fetch(`/api/translation/jobs/${j.id}/status`);
          if (!res.ok) return null;
          const data = (await res.json()) as JobStatusResponse;
          return data.job;
        })
      );

      onUpdate((prev) => {
        let next = prev;
        for (const result of results) {
          if (result.status !== "fulfilled" || !result.value) continue;
          const updated = result.value;
          next = next.map((j) => {
            if (j.id !== updated.id) return j;
            // Only apply if newer
            if (new Date(updated.updatedAt) <= new Date(j.updatedAt)) return j;
            return { ...j, ...updated } as T;
          });
        }
        return next;
      });
    }

    // Initial poll
    void pollActiveJobs();
    intervalId = setInterval(() => void pollActiveJobs(), POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        // Tab became visible — immediate fetch + restart interval
        void pollActiveJobs();
        if (!intervalId) {
          intervalId = setInterval(() => void pollActiveJobs(), POLL_INTERVAL_MS);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasActiveJobs, onUpdate]);
}
