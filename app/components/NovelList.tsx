import type { Novel } from "@/app/generated/prisma/client";
import { BookshelfRow } from "@/components/bookshelf-row";

interface NovelListProps {
  novels: Novel[];
  progressData?: Record<string, { lastChapterIndex: number; totalChapters: number }>;
}

const SHELF_SIZE = 5;

export function NovelList({ novels, progressData }: NovelListProps) {
  if (novels.length === 0) {
    return null;
  }

  const shelves: Novel[][] = [];
  for (let i = 0; i < novels.length; i += SHELF_SIZE) {
    shelves.push(novels.slice(i, i + SHELF_SIZE));
  }

  return (
    <div className="space-y-6">
      {shelves.map((shelfNovels, idx) => (
        <BookshelfRow key={idx} novels={shelfNovels} progressData={progressData} />
      ))}
    </div>
  );
}
