"use client";

import { useMemo } from "react";
import { calculateTranslationEta } from "@/lib/translation-eta";
import type { ChapterTiming, TranslationEta } from "@/lib/translation-eta";

/**
 * React hook that memoizes the ETA calculation for a translation job.
 * Wraps the pure calculateTranslationEta function with useMemo to avoid
 * recomputing on every render during 3-second polling cycles.
 */
export function useTranslationEta(
  chapterStatuses: ChapterTiming[],
  totalChapters: number,
  jobCreatedAt: string | undefined,
): TranslationEta {
  return useMemo(
    () => calculateTranslationEta(chapterStatuses, totalChapters, jobCreatedAt),
    [chapterStatuses, totalChapters, jobCreatedAt],
  );
}
