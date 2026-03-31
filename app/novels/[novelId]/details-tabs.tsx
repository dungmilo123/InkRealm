"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { ReaderSummary } from "@/app/lib/reader";
import { Badge } from "@/components/ui/badge";
import { TranslationPanel } from "./translation-panel";
import { GlossaryPanel } from "./glossary-panel";
import { useTranslationPolling } from "./use-translation-polling";
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

function ChapterList({
  novelId,
  chapters,
  readingProgress,
  chapterStatuses,
}: {
  novelId: string;
  chapters: { index: number; title: string }[];
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
            {translationStatus === "translated" && (
              <Badge className="ml-auto shrink-0 bg-primary/10 text-primary border-0 text-xs">
                Translated
              </Badge>
            )}
            {translationStatus === "translating" && (
              <Badge className="ml-auto shrink-0 bg-muted text-muted-foreground border-0 text-xs animate-pulse">
                Translating...
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function DetailsTabs({
  novelId,
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
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
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
          </p>
        </div>
      )}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
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

      <div className="pt-4">
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
        )}

        {activeTab === "Glossary" && <GlossaryPanel novelId={novelId} />}
      </div>
    </div>
  );
}
