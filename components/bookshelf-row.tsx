import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import type { Novel } from "@/app/generated/prisma/client";

interface BookshelfRowProps {
  novels: Novel[];
  progressData?: Record<string, { lastChapterIndex: number; totalChapters: number }>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function BookshelfRow({ novels, progressData }: BookshelfRowProps) {
  if (novels.length === 0) {
    return null;
  }

  return (
    <div className="mb-10 last:mb-0">
      <div className="flex flex-wrap gap-5">
        {novels.map((novel) => {
          const progress = progressData?.[novel.id];
          return (
            <Link
              key={novel.id}
              href={`/novels/${novel.id}`}
              className="group flex flex-col gap-2"
            >
              <div className="relative">
                <BookCover
                  title={novel.title}
                  id={novel.id}
                  fileType={novel.fileType}
                  className="transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-1"
                />
                {progress && progress.totalChapters > 0 && (
                  <span className="absolute bottom-1 right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                    Ch {progress.lastChapterIndex}/{progress.totalChapters}
                  </span>
                )}
              </div>
              <div className="w-[120px]">
                <p className="text-xs font-medium text-foreground truncate leading-tight">
                  {novel.title}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {novel.fileType.toUpperCase()} · {formatFileSize(novel.sizeBytes)}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatDate(novel.createdAt)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[oklch(0.88_0.01_85)] shadow-inner" />
    </div>
  );
}
