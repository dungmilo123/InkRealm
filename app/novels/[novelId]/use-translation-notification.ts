"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notifications";

type JobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";

type TranslationNotificationOptions = {
  /** Current job status (null if no job) */
  jobStatus: JobStatus | null;
  /** Novel title for the notification body */
  novelTitle?: string;
  /** Total chapters in the translation */
  totalChapters?: number;
  /** Number of chapters completed */
  completedChapters?: number;
  /** Unique job ID for notification deduplication */
  jobId?: string;
};

/**
 * Hook that triggers a browser notification when a translation job
 * completes or fails while the user is on another tab/window.
 *
 * Also provides permission management: a function to request permission
 * and the current permission state for UI affordance (e.g. showing an
 * "Enable notifications" prompt).
 */
export function useTranslationNotification(options: TranslationNotificationOptions) {
  const { jobStatus, novelTitle, totalChapters, completedChapters, jobId } = options;

  const prevStatusRef = useRef<JobStatus | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () => getNotificationPermission()
  );

  // Track status transitions
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = jobStatus;

    // Only fire on transition from an active status to a terminal one
    const wasActive = prevStatus === "PENDING" || prevStatus === "IN_PROGRESS";
    if (!wasActive) return;

    if (jobStatus === "COMPLETED") {
      const chaptersText = totalChapters
        ? `${completedChapters ?? totalChapters} of ${totalChapters} chapters translated`
        : "All chapters translated";

      sendNotification({
        title: "Translation Complete ✓",
        body: novelTitle
          ? `${novelTitle} — ${chaptersText}`
          : chaptersText,
        tag: jobId ? `translation-${jobId}` : "translation-complete",
        autoCloseMs: 10_000,
        onClick: () => {
          // Tab will be focused by sendNotification's onclick handler
        },
      });
    } else if (jobStatus === "FAILED") {
      sendNotification({
        title: "Translation Failed",
        body: novelTitle
          ? `${novelTitle} — translation stopped due to an error`
          : "Translation stopped due to an error",
        tag: jobId ? `translation-${jobId}` : "translation-failed",
        autoCloseMs: 15_000,
        onClick: () => {
          // Tab will be focused by sendNotification's onclick handler
        },
      });
    }
  }, [jobStatus, novelTitle, totalChapters, completedChapters, jobId]);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    /** Current notification permission state */
    permission,
    /** Whether notifications are supported in this browser */
    isSupported: isNotificationSupported(),
    /** Whether the user has granted permission */
    isGranted: permission === "granted",
    /** Whether we can still ask (not yet prompted) */
    canRequest: permission === "default",
    /** Request notification permission — returns the new state */
    requestPermission,
  };
}
