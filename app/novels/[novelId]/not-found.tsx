import Link from "next/link";

export default function NovelNotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Novel not available
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          The requested novel or chapter could not be found, or this file cannot be read in
          the in-app reader.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-6 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Back to library
          </Link>
        </div>
      </div>
    </div>
  );
}
