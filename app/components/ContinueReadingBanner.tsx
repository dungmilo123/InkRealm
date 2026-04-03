import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { BookCover } from "@/components/book-cover";

export interface ContinueReadingData {
  novel: {
    id: string;
    title: string;
    fileType: string;
    chapterCount: number | null;
  };
  lastChapterIndex: number;
  totalVisited: number;
  lastReadAt: string; // ISO string (serialized from Date)
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ContinueReadingCard({
  data,
  isPrimary,
}: {
  data: ContinueReadingData;
  isPrimary: boolean;
}) {
  const { novel, lastChapterIndex, totalVisited, lastReadAt } = data;
  const totalChapters = novel.chapterCount ?? 0;
  const progressPercent =
    totalChapters > 0
      ? Math.round((totalVisited / totalChapters) * 100)
      : 0;
  const isComplete = progressPercent === 100;

  // If the novel is finished, suggest re-reading chapter 1; otherwise resume
  const targetChapter = isComplete ? 0 : lastChapterIndex;
  const ctaLabel = isComplete ? "Re-read" : "Continue reading";

  return (
    <Link
      href={`/novels/${novel.id}/read/${targetChapter}`}
      className="group block"
      aria-label={`${ctaLabel} ${novel.title}, chapter ${targetChapter + 1}`}
    >
      <div className="relative overflow-hidden rounded-lg border border-border bg-card/50 transition-colors duration-200 group-hover:bg-card group-hover:border-primary/30">
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Mini book cover */}
          <div className="shrink-0">
            <BookCover
              title={novel.title}
              id={novel.id}
              fileType={novel.fileType}
              width={isPrimary ? 48 : 40}
              height={isPrimary ? 72 : 60}
              className="rounded shadow-sm"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <BookOpen
                className="size-3.5 text-primary shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-primary">
                {ctaLabel}
              </span>
              <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                {formatRelativeTime(lastReadAt)}
              </span>
            </div>

            <p className={`font-medium text-foreground truncate ${isPrimary ? "text-sm" : "text-[13px]"}`}>
              {novel.title}
            </p>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground tabular-nums">
                {isComplete
                  ? `Finished (${totalChapters} ch)`
                  : `Ch ${lastChapterIndex + 1} of ${totalChapters || "?"}`}
              </span>

              {/* Progress bar */}
              {totalChapters > 0 && (
                <div className="flex-1 max-w-[120px]">
                  <div
                    className="h-1 rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Reading progress: ${progressPercent}%`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isComplete
                          ? "bg-green-500 dark:bg-green-400"
                          : "bg-primary"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight
            className="size-5 text-muted-foreground/40 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

/**
 * Renders a single ContinueReadingBanner (backward-compatible).
 */
export function ContinueReadingBanner({
  continueReading,
}: {
  continueReading: ContinueReadingData;
}) {
  return <ContinueReadingCard data={continueReading} isPrimary />;
}

/**
 * Renders multiple recently-read novels as a list of compact cards.
 * The first novel (most recently read) gets a slightly larger cover.
 */
export function RecentlyReadList({
  novels,
}: {
  novels: ContinueReadingData[];
}) {
  if (novels.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {novels.map((data, i) => (
        <ContinueReadingCard key={data.novel.id} data={data} isPrimary={i === 0} />
      ))}
    </div>
  );
}
