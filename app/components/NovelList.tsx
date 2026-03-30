import Link from "next/link";
import type { Novel } from "@/app/generated/prisma/client";
import { BookCover } from "@/components/book-cover";
import { Card } from "@/components/ui/card";

interface NovelListProps {
  novels: Novel[];
  progressData?: Record<string, { lastChapterIndex: number; totalChapters: number }>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NovelList({ novels, progressData }: NovelListProps) {
  if (novels.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {novels.map((novel) => {
        const progress = progressData?.[novel.id];
        return (
          <Link
            key={novel.id}
            href={`/novels/${novel.id}`}
            className="group"
          >
            <Card className="overflow-hidden border-0 bg-transparent shadow-none transition-all duration-200 group-hover:scale-[1.02] group-hover:-translate-y-1 group-hover:shadow-md">
              <div className="relative">
                <BookCover
                  title={novel.title}
                  id={novel.id}
                  fileType={novel.fileType}
                  className="w-full transition-transform duration-200"
                />
                {progress && progress.totalChapters > 0 && (
                  <span className="absolute bottom-1 right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                    Ch {progress.lastChapterIndex}/{progress.totalChapters}
                  </span>
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
