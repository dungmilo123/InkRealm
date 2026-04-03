"use client";

import { useState, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import type { ReaderSummary } from "@/app/lib/reader";
import { Badge } from "@/components/ui/badge";
import { TranslationPanel } from "./translation-panel";
import { GlossaryPanel } from "./glossary-panel";
import { useTranslationPolling } from "./use-translation-polling";
import { useTranslationEta } from "./use-translation-eta";
import { useTranslationNotification } from "./use-translation-notification";
import { estimateReadingMinutes, formatReadingTime } from "@/lib/reading-time";
import { Bell, BellOff, Search, X, ChevronDown } from "lucide-react";
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

type ChapterStatusFilter = "all" | "read" | "unread" | "translated";

const STATUS_FILTER_LABELS: { value: ChapterStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "read", label: "Read" },
  { value: "unread", label: "Unread" },
  { value: "translated", label: "Translated" },
];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChapterStatusFilter>("all");
  const [expandedSummaries, setExpandedSummaries] = useState<Set<number>>(new Set());

  const visitedSet = useMemo(
    () => new Set(readingProgress?.visitedChapterIndices ?? []),
    [readingProgress?.visitedChapterIndices]
  );
  const lastChapter = readingProgress?.lastChapterIndex ?? null;
  const statusMap = useMemo(
    () => new Map(chapterStatuses.map((s) => [s.chapterIndex, s.status])),
    [chapterStatuses]
  );
  const summaryMap = useMemo(
    () => new Map(
      chapterStatuses
        .filter((s) => s.summary)
        .map((s) => [s.chapterIndex, s.summary as string])
    ),
    [chapterStatuses]
  );

  const toggleSummary = useCallback((chapterIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(chapterIndex)) next.delete(chapterIndex);
      else next.add(chapterIndex);
      return next;
    });
  }, []);

  // Count chapters per status for filter badges
  const statusCounts = useMemo(() => {
    let read = 0;
    let unread = 0;
    let translated = 0;
    for (const ch of chapters) {
      if (visitedSet.has(ch.index)) read++;
      else unread++;
      if (statusMap.get(ch.index) === "translated") translated++;
    }
    return { all: chapters.length, read, unread, translated };
  }, [chapters, visitedSet, statusMap]);

  // Filter chapters by search + status
  const filteredChapters = useMemo(() => {
    const query = search.toLowerCase().trim();
    return chapters.filter((ch) => {
      // Search filter: match title or chapter number
      if (query) {
        const matchesTitle = ch.title.toLowerCase().includes(query);
        const matchesIndex = String(ch.index) === query;
        if (!matchesTitle && !matchesIndex) return false;
      }
      // Status filter
      if (statusFilter === "read") return visitedSet.has(ch.index);
      if (statusFilter === "unread") return !visitedSet.has(ch.index);
      if (statusFilter === "translated") return statusMap.get(ch.index) === "translated";
      return true;
    });
  }, [chapters, search, statusFilter, visitedSet, statusMap]);

  const hasActiveFilters = search.length > 0 || statusFilter !== "all";

  return (
    <div>
      {/* Search + filters toolbar */}
      <div className="space-y-3 pb-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chapters by title or number..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            aria-label="Search chapters"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTER_LABELS.map(({ value, label }) => {
            const count = statusCounts[value];
            // Hide empty tabs (except "All")
            if (value !== "all" && count === 0) return null;
            const isActive = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
                aria-pressed={isActive}
              >
                {label}
                <span className={`tabular-nums ${isActive ? "text-primary/70" : "text-muted-foreground/50"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapter list */}
      <div className="divide-y divide-border">
        {filteredChapters.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No chapters match your filters."
                : "No chapters available."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredChapters.map((ch) => {
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
            const summary = summaryMap.get(ch.index);
            const isExpanded = expandedSummaries.has(ch.index);

            return (
              <div key={ch.index}>
                <Link
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
                  {summary && (
                    <button
                      type="button"
                      onClick={(e) => toggleSummary(ch.index, e)}
                      className="shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Hide chapter summary" : "Show chapter summary"}
                      title={isExpanded ? "Hide summary" : "Show AI summary"}
                    >
                      <ChevronDown className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
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
                    <Badge className="shrink-0 bg-muted text-muted-foreground border-0 text-xs motion-safe:animate-pulse">
                      Translating...
                    </Badge>
                  )}
                </Link>
                {summary && isExpanded && (
                  <div className="px-3 pb-3 pl-[4.25rem]">
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-md px-3 py-2 border border-border/50">
                      <span className="font-medium text-muted-foreground/80">AI Summary</span>
                      <span className="mx-1.5 text-border">·</span>
                      {summary}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Result count when filtering */}
      {hasActiveFilters && filteredChapters.length > 0 && (
        <div className="pt-2 pb-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {filteredChapters.length} of {chapters.length} chapters
          </p>
          <button
            type="button"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}
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
