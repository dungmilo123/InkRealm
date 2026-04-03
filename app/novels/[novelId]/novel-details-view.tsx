import Link from "next/link";
import type { Novel } from "@/app/generated/prisma/client";
import type { ReaderSummary } from "@/app/lib/reader";
import { BookCover } from "@/components/book-cover";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LibraryShelf } from "@/components/library-shelf";
import { DetailsTabs } from "./details-tabs";
import { DeleteNovelButtonClient } from "./delete-novel-button-client";
import { formatFileSize } from "@/app/lib/format";
import {
  estimateReadingMinutes,
  formatReadingTime,
  formatWordCount,
} from "@/lib/reading-time";
import type { NovelReadingStats } from "@/lib/reading-stats";
import { BookOpen, Clock, Type } from "lucide-react";

export type SerializedDefaultProfile = {
  id: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
} | null;

export type SerializedTranslationJob = {
  id: string;
  novelId: string;
  targetLanguage: string;
  providerSnapshot: string;
  modelSnapshot: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  totalChapters: number;
  completedChapters: number;
  failedChapterIndex: number | null;
  failureReason: string | null;
  exportPath: string | null;
  createdAt: string;
  updatedAt: string;
  progressPercent: number;
  downloadUrl: string | null;
};

export type ChapterTranslationStatus = {
  chapterIndex: number;
  status: "translated" | "translating" | "untranslated";
  /** ISO timestamp when chapter finished translating (only for translated chapters) */
  completedAt?: string;
};

type ReadingProgressData = {
  lastChapterIndex: number;
  visitedChapterIndices: number[];
} | null;

type NovelDetailsViewProps = {
  novel: Novel;
  readerSummary: ReaderSummary;
  readingProgress: ReadingProgressData;
  novelReadingStats: NovelReadingStats | null;
  translationDataError: string | null;
  serializedDefaultProfile: SerializedDefaultProfile;
  serializedLatestJob: SerializedTranslationJob | null;
  chapterCount: number;
  initialChapterStatuses: ChapterTranslationStatus[];
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function NovelDetailsView({
  novel,
  readerSummary,
  readingProgress,
  novelReadingStats,
  translationDataError,
  serializedDefaultProfile,
  serializedLatestJob,
  chapterCount,
  initialChapterStatuses,
}: NovelDetailsViewProps) {
  const readHref = readingProgress
    ? `/novels/${novel.id}/read/${readingProgress.lastChapterIndex}`
    : `/novels/${novel.id}/read/1`;
  const readLabel = readingProgress
    ? `Continue Reading → Chapter ${readingProgress.lastChapterIndex}`
    : "Start Reading";

  return (
    <LibraryShelf showBack backHref="/dashboard">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: novel.title },
        ]}
      />
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row gap-8 items-start">
          <BookCover
            title={novel.title}
            id={novel.id}
            fileType={novel.fileType}
            className="shrink-0"
            width={140}
            height={210}
          />
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">
                  {novel.title}
                </h1>
                <DeleteNovelButtonClient novelId={novel.id} novelTitle={novel.title} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Added {formatDate(novel.createdAt)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">File</dt>
                <dd className="mt-0.5 text-foreground">{novel.originalFileName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Format</dt>
                <dd className="mt-0.5 text-foreground uppercase">{novel.fileType}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="mt-0.5 text-foreground">{formatFileSize(novel.sizeBytes)}</dd>
              </div>
              {readerSummary.isReadable && (
                <div>
                  <dt className="text-muted-foreground">Chapters</dt>
                  <dd className="mt-0.5 text-foreground">{readerSummary.chapterCount}</dd>
                </div>
              )}
              {readerSummary.totalWordCount > 0 && (
                <>
                  <div>
                    <dt className="text-muted-foreground">Words</dt>
                    <dd className="mt-0.5 text-foreground">
                      {formatWordCount(readerSummary.totalWordCount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reading time</dt>
                    <dd className="mt-0.5 text-foreground">
                      {formatReadingTime(estimateReadingMinutes(readerSummary.totalWordCount))}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Per-novel reading stats — only shown when user has reading activity */}
        {novelReadingStats && novelReadingStats.chaptersRead > 0 && (
          <div className="rounded-lg border border-border bg-card/50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
              Your Reading Progress
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">Chapters read</span>
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {novelReadingStats.chaptersRead} of {readerSummary.chapterCount}
                </span>
              </div>
              {novelReadingStats.wordsRead > 0 && (
                <div className="flex items-center gap-1.5">
                  <Type className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">Words read</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {formatWordCount(novelReadingStats.wordsRead)}
                  </span>
                </div>
              )}
              {novelReadingStats.estimatedMinutes > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">Time spent</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {novelReadingStats.estimatedTimeLabel}
                  </span>
                </div>
              )}
              {/* Completion percentage */}
              {readerSummary.chapterCount > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <div
                    className="w-20 h-1.5 rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round((novelReadingStats.chaptersRead / readerSummary.chapterCount) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Reading progress: ${Math.round((novelReadingStats.chaptersRead / readerSummary.chapterCount) * 100)}%`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.round((novelReadingStats.chaptersRead / readerSummary.chapterCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                    {Math.round((novelReadingStats.chaptersRead / readerSummary.chapterCount) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-border pt-6">
          {readerSummary.isReadable ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {readingProgress
                  ? `You were on Chapter ${readingProgress.lastChapterIndex} of ${readerSummary.chapterCount}.`
                  : "Ready to read. Start from the beginning and navigate between chapters."}
              </p>
              <Link
                href={readHref}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label={readingProgress
                  ? `Continue reading "${novel.title}" from chapter ${readingProgress.lastChapterIndex}`
                  : `Start reading "${novel.title}"`}
              >
                {readLabel}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                In-app reading is unavailable for this novel.
              </p>
              {readerSummary.unavailableReason ? (
                <p className="text-xs text-muted-foreground/70">
                  {readerSummary.unavailableReason}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {translationDataError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {translationDataError}
          </div>
        ) : null}

        <DetailsTabs
          novelId={novel.id}
          novelTitle={novel.title}
          readerSummary={readerSummary}
          readingProgress={readingProgress}
          isReadable={readerSummary.isReadable}
          serializedDefaultProfile={serializedDefaultProfile}
          serializedLatestJob={serializedLatestJob}
          chapterCount={chapterCount}
          initialChapterStatuses={initialChapterStatuses}
        />
      </div>
    </LibraryShelf>
  );
}
