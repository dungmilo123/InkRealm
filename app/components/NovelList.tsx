import Link from "next/link";
import type { Novel } from "@/app/generated/prisma/client";
import { BookCover } from "@/components/book-cover";
import { Card } from "@/components/ui/card";
import { formatFileSize } from "@/app/lib/format";

export interface NovelProgressData {
  lastChapterIndex: number;
  totalChapters: number;
  totalVisited: number;
}

interface NovelListProps {
  novels: Novel[];
  progressData?: Record<string, NovelProgressData>;
}

export function NovelList({ novels, progressData }: NovelListProps) {
  if (novels.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {novels.map((novel) => {
        const progress = progressData?.[novel.id];
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
                      aria-label={
                        isComplete
                          ? "Reading complete"
                          : `Chapter ${progress.lastChapterIndex} of ${progress.totalChapters}`
                      }
                    >
                      {isComplete
                        ? "\u2713 Done"
                        : `Ch ${progress.lastChapterIndex}/${progress.totalChapters}`}
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
