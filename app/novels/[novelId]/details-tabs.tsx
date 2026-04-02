"use client";

import { useState, useCallback, memo } from "react";
import Link from "next/link";
import type { ReaderSummary } from "@/app/lib/reader";
import { Badge } from "@/components/ui/badge";
import { TranslationPanel } from "./translation-panel";
import { GlossaryPanel } from "./glossary-panel";
import { useTranslationPolling } from "./use-translation-polling";
import { useTranslationEta } from "./use-translation-eta";
import { useTranslationNotification } from "./use-translation-notification";
import { estimateReadingMinutes, formatReadingTime } from "@/lib/reading-time";
import { Bell, BellOff } from "lucide-react";
import type {
  SerializedDefaultProfile,
  SerializedTranslationJob,
  ChapterTranslationStatus,
} from "./novel-details-view";

type ReadingProgressData = {
  lastChapterIndex: number;
  visitedChapterIndices: number[];
} | null;

type DetailsTabsProps = {
  novelId: string;
  novelTitle: string;
  readerSummary: ReaderSummary;
  readingProgress: ReadingProgressData;
  isReadable: boolean;
  serializedDefaultProfile: SerializedDefaultProfile;
  serializedLatestJob: SerializedTranslationJob | null;
  chapterCount: number;
  initialChapterStatuses: ChapterTranslationStatus[];
};

const TABS = ["Chapters", "Translation", "Glossary"] as const;
type Tab = (typeof TABS)[number];

const ChapterList = memo(function ChapterList({
  novelId,
  chapters,
  readingProgress,
  chapterStatuses,
}: {
  novelId: string;
  chapters: { index: number; title: string; wordCount: number }[];
  readingProgress: ReadingProgressData;
  chapterStatuses: ChapterTranslationStatus[];
}) {
  const visitedSet = new Set(readingProgress?.visitedChapterIndices ?? []);
  const lastChapter = readingProgress?.lastChapterIndex ?? null;
  const statusMap = new Map(chapterStatuses.map((s) => [s.chapterIndex, s.status]));

  return (
    <div className="divide-y divide-border">
      {chapters.map((ch) => {
        const isLast = ch.index === lastChapter;
        const isVisited = visitedSet.has(ch.index);

        let indicator: string;
        let indicatorClass: string;
        if (isLast) {
          indicator = "\u25C9"; // ◉
          indicatorClass = "text-primary";
        } else if (isVisited) {
          indicator = "\u2713"; // ✓
          indicatorClass = "text-green-600 dark:text-green-400";
        } else {
          indicator = "\u25CB"; // ○
          indicatorClass = "text-muted-foreground/50";
        }

        const translationStatus = statusMap.get(ch.index);
        const readingMin = estimateReadingMinutes(ch.wordCount);

        return (
          <Link
            key={ch.index}
            href={`/novels/${novelId}/read/${ch.index}`}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors group"
          >
            <span className={`text-sm w-5 text-center ${indicatorClass}`}>
              {indicator}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums w-8">
              {ch.index}
            </span>
            <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {ch.title}
            </span>
            {ch.wordCount > 0 && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground/60 tabular-nums">
                {formatReadingTime(readingMin)}
              </span>
            )}
            {translationStatus === "translated" && (
              <Badge className="shrink-0 bg-primary/10 text-primary border-0 text-xs">
                Translated
              </Badge>
            )}
            {translationStatus === "translating" && (
              <Badge className="shrink-0 bg-muted text-muted-foreground border-0 text-xs animate-pulse">
                Translating...
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
});

export function DetailsTabs({
  novelId,
  novelTitle,
  readerSummary,
  readingProgress,
  isReadable,
  serializedDefaultProfile,
  serializedLatestJob,
  chapterCount,
  initialChapterStatuses,
}: DetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Chapters");
  const [job, setJob] = useState(serializedLatestJob);
  const handleJobUpdate = useCallback(
    (updater: (prev: typeof job) => typeof job) => setJob(updater),
    []
  );
  const { isHanging, hangingChapterIndex, chapterStatuses: polledChapterStatuses } =
    useTranslationPolling(job, handleJobUpdate);

  // Browser notifications for background translation completion
  const { canRequest, isGranted, isSupported, requestPermission } =
    useTranslationNotification({
      jobStatus: job?.status ?? null,
      novelTitle,
      totalChapters: job?.totalChapters,
      completedChapters: job?.completedChapters,
      jobId: job?.id,
    });

  // Use polled statuses when available, fall back to initial SSR statuses
  const chapterStatuses = polledChapterStatuses.length > 0
    ? polledChapterStatuses
    : initialChapterStatuses;

  // Derive progress from chapter statuses (accurate during translation, unlike job.completedChapters)
  const translatedCount = chapterStatuses.filter((s) => s.status === "translated").length;
  const totalChaptersForProgress = job?.totalChapters ?? chapterCount;
  const progressPercent = totalChaptersForProgress > 0
    ? Math.round((translatedCount / totalChaptersForProgress) * 100)
    : 0;
  const isCompleted = job?.status === "COMPLETED";
  const isTranslating = job?.status === "IN_PROGRESS" || job?.status === "PENDING";

  // ETA calculation from chapter completion timestamps
  const { etaLabel } = useTranslationEta(chapterStatuses, totalChaptersForProgress, job?.createdAt);

  return (
    <div>
      {job && (
        <div className="py-4">
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Translation progress"
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-primary motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2" aria-live="polite">
            {isCompleted
              ? "All chapters translated"
              : `${translatedCount} of ${totalChaptersForProgress} chapters translated`}
            {!isCompleted && (
              <span className="text-xs text-muted-foreground ml-2">
                ({progressPercent}%)
              </span>
            )}
            {isTranslating && etaLabel && (
              <span className="text-xs text-muted-foreground/70 ml-1.5">
                · {etaLabel} remaining
              </span>
            )}
          </p>
        </div>
      )}
      <div role="tablist" aria-label="Novel sections" className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab.toLowerCase()}`}
            id={`tab-${tab.toLowerCase()}`}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab.toLowerCase()}`}
        aria-labelledby={`tab-${activeTab.toLowerCase()}`}
        className="pt-4"
      >
        {activeTab === "Chapters" && (
          readerSummary.isReadable && readerSummary.chapters ? (
            <ChapterList
              novelId={novelId}
              chapters={readerSummary.chapters}
              readingProgress={readingProgress}
              chapterStatuses={chapterStatuses}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Chapter list is not available for this novel.
            </p>
          )
        )}

        {activeTab === "Translation" && (
          <>
            <TranslationPanel
              novelId={novelId}
              isReadable={isReadable}
              defaultProfile={serializedDefaultProfile}
              job={job}
              onJobUpdate={setJob}
              isHanging={isHanging}
              hangingChapterIndex={hangingChapterIndex}
              chapterCount={chapterCount}
              chapterStatuses={chapterStatuses}
            />
            {/* Notification opt-in: show when translating + permission not yet granted */}
            {isTranslating && isSupported && canRequest && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Get notified when translation finishes — even in another tab.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void requestPermission()}
                    className="shrink-0 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                  >
                    Enable
                  </button>
                </div>
              </div>
            )}
            {/* Confirmation when notifications are active during translation */}
            {isTranslating && isGranted && (
              <div className="mt-3 flex items-center gap-2 px-1">
                <Bell className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground/60">
                  You&apos;ll be notified when translation finishes
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "Glossary" && <GlossaryPanel novelId={novelId} />}
      </div>
    </div>
  );
}
