import Link from "next/link";
import type { Novel } from "@/app/generated/prisma/client";
import { BookCover } from "@/components/book-cover";
import { Card } from "@/components/ui/card";
import { formatFileSize } from "@/app/lib/format";
import { Bookmark, Pin } from "lucide-react";

export interface NovelProgressData {
  lastChapterIndex: number;
  totalChapters: number;
  totalVisited: number;
  /** ISO 8601 timestamp of the last reading activity for this novel */
  lastReadAt?: string;
}

interface NovelListProps {
  novels: Novel[];
  progressData?: Record<string, NovelProgressData>;
  bookmarkCounts?: Record<string, number>;
  onTogglePin?: (novelId: string) => void;
}

export function NovelList({ novels, progressData, bookmarkCounts, onTogglePin }: NovelListProps) {
  if (novels.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {novels.map((novel) => {
        const progress = progressData?.[novel.id];
        const bookmarkCount = bookmarkCounts?.[novel.id] ?? 0;
        const progressPercent =
          progress && progress.totalChapters > 0
            ? Math.round(
                (progress.totalVisited / progress.totalChapters) * 100
              )
            : 0;
        const isComplete = progressPercent === 100;

        return (
          <Link
            key={novel.id}
            href={`/novels/${novel.id}`}
            className="group"
            aria-label={`Open ${novel.title}`}
          >
            <Card className="overflow-hidden border-0 bg-transparent shadow-none transition-all duration-200 motion-safe:group-hover:scale-[1.02] motion-safe:group-hover:-translate-y-1 group-hover:shadow-md">
              <div className="relative">
                <BookCover
                  title={novel.title}
                  id={novel.id}
                  fileType={novel.fileType}
                  className="w-full transition-transform duration-200"
                />
                {/* Pin button — top-right of book cover */}
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTogglePin(novel.id);
                    }}
                    className={`absolute top-1.5 right-1.5 flex items-center justify-center rounded-full p-1 shadow-sm transition-all ${
                      novel.isPinned
                        ? "bg-primary text-primary-foreground"
                        : "bg-black/40 text-white/70 opacity-0 group-hover:opacity-100"
                    }`}
                    aria-label={novel.isPinned ? `Unpin ${novel.title}` : `Pin ${novel.title}`}
                    title={novel.isPinned ? "Unpin from top" : "Pin to top"}
                  >
                    <Pin className={`size-3 ${novel.isPinned ? "fill-current" : ""}`} aria-hidden="true" />
                  </button>
                )}
                {/* Bookmark count badge — top-left of book cover */}
                {bookmarkCount > 0 && (
                  <span
                    className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                    aria-label={`${bookmarkCount} bookmark${bookmarkCount !== 1 ? "s" : ""}`}
                  >
                    <Bookmark className="size-2.5 fill-current" aria-hidden="true" />
                    {bookmarkCount}
                  </span>
                )}
                {progress && progress.totalChapters > 0 && (
                  <>
                    {/* Progress bar along bottom edge of book cover */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-black/20"
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Reading progress: ${progressPercent}%`}
                    >
                      <div
                        className={`h-full transition-all duration-300 ${
                          isComplete
                            ? "bg-green-500 dark:bg-green-400"
                            : "bg-primary"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    {/* Chapter badge */}
                    <span
                      className={`absolute bottom-2 right-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${
                        isComplete
                          ? "bg-green-600 text-white dark:bg-green-500"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <span className="sr-only">
                        {isComplete
                          ? "Reading complete"
                          : `Chapter ${progress.lastChapterIndex} of ${progress.totalChapters}`}
                      </span>
                      <span aria-hidden="true">
                        {isComplete
                          ? "\u2713 Done"
                          : `Ch ${progress.lastChapterIndex}/${progress.totalChapters}`}
                      </span>
                    </span>
                  </>
                )}
              </div>
              <div className="mt-2 px-0.5">
                <p className="text-sm font-medium text-foreground truncate">
                  {novel.title}
                </p>
                <p className="text-sm text-muted-foreground/70">
                  {novel.fileType.toUpperCase()} · {formatFileSize(novel.sizeBytes)}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
