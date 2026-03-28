import { listNovels } from "@/app/lib/novels";
import { NovelList } from "@/app/components/NovelList";
import { UploadForm } from "@/app/components/UploadForm";
import { LibraryShelf } from "@/components/library-shelf";
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
    <LibraryShelf title="My Library">
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Add to your library
        </h2>
        <UploadForm />
      </section>
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Your collection
        </h2>
        {error ? (
          <div className="p-6 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            {error}
          </div>
        ) : novels.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <svg
                className="size-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <p className="text-muted-foreground mb-2">Your library is empty</p>
            <p className="text-sm text-muted-foreground/70">
              Upload your first novel to get started
            </p>
          </div>
        ) : (
          <NovelList novels={novels} />
        )}
      </section>
    </LibraryShelf>
  );
}
