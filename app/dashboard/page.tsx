import { listNovels } from "@/app/lib/novels";
import { NovelList } from "@/app/components/NovelList";
import { UploadForm } from "@/app/components/UploadForm";
import type { Novel } from "@/app/generated/prisma/client";

export default async function DashboardPage() {
  let novels: Novel[] = [];
  let error: string | null = null;

  try {
    novels = await listNovels();
  } catch {
    error = "Failed to load novels. Please ensure the database is configured.";
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            My Library
          </h1>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-8 py-8">
        <section className="mb-10">
          <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-4">
            Upload New Novel
          </h2>
          <UploadForm />
        </section>
        <section>
          <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-4">
            Your Collection
          </h2>
          {error ? (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : (
            <NovelList novels={novels} />
          )}
        </section>
      </main>
    </div>
  );
}