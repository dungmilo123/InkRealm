import type { Novel } from "@/app/generated/prisma/client";

interface NovelListProps {
  novels: Novel[];
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

export function NovelList({ novels }: NovelListProps) {
  if (novels.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <p className="text-zinc-500 dark:text-zinc-400">
          No novels uploaded yet. Upload your first novel above.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {novels.map((novel) => (
          <li key={novel.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {novel.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {novel.originalFileName} &middot; {novel.fileType.toUpperCase()} &middot;{" "}
                  {formatFileSize(novel.sizeBytes)}
                </p>
              </div>
              <div className="ml-4 text-right">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatDate(novel.createdAt)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}