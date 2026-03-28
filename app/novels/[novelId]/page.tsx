import Link from "next/link";
import { getNovelByIdOrNotFound } from "@/app/lib/novels";
import { getReaderSummary } from "@/app/lib/reader";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function NovelDetailsPage({
  params,
}: {
  params: Promise<{ novelId: string }>;
}) {
  const { novelId } = await params;
  const novel = await getNovelByIdOrNotFound(novelId);
  const readerSummary = await getReaderSummary(novel);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 mb-3"
          >
            Back to library
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {novel.title}
          </h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-8 py-8 space-y-8">
        <section className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
            Novel Metadata
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Original Filename</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100 break-all">
                {novel.originalFileName}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">File Type</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100 uppercase">
                {novel.fileType}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">File Size</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatFileSize(novel.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Uploaded</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatDate(novel.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Chapter Count</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {readerSummary.isReadable ? readerSummary.chapterCount : "Unavailable"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-3">
            Reader
          </h2>

          {readerSummary.isReadable ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This novel is ready to read in-app. Start from chapter 1 and use chapter
                navigation while reading.
              </p>
              <Link
                href={`/novels/${novel.id}/read/1`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-6 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Start Reading
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                In-app reading is unavailable for this novel.
              </p>
              {readerSummary.unavailableReason ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {readerSummary.unavailableReason}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
