import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { listNovels } from "@/app/lib/novels";
import { getReadingProgressBatch, getContinueReadingNovel } from "@/app/lib/reading-progress";
import { getBookmarkCountsBatch } from "@/app/lib/bookmarks";
import { getChapterVisitsForAnalytics } from "@/app/lib/reading-stats-data";
import { computeReadingAnalytics, computeDailyActivity, type ReadingAnalytics, type DailyActivity } from "@/lib/reading-stats";
import { NovelLibrary } from "@/app/components/NovelLibrary";
import { UploadForm } from "@/app/components/UploadForm";
import { LibraryShelf } from "@/components/library-shelf";
import { ReadingStatsBanner } from "@/app/components/ReadingStatsBanner";
import { ContinueReadingBanner, type ContinueReadingData } from "@/app/components/ContinueReadingBanner";
import { ActivityHeatmap } from "@/app/components/ActivityHeatmap";
import type { Novel } from "@/app/generated/prisma/client";
import type { NovelProgressData } from "@/app/components/NovelList";

export const metadata: Metadata = {
  title: "Library",
  description: "Your personal novel library — browse, search, and manage your collection",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  let novels: Novel[] = [];
  let error: string | null = null;
  let progressMap = new Map<string, { lastChapterIndex: number; totalVisited: number; updatedAt: Date }>();
  let bookmarkCountMap = new Map<string, number>();
  let analytics: ReadingAnalytics | null = null;
  let dailyActivity: DailyActivity[] = [];
  let continueReading: ContinueReadingData | null = null;

  try {
    novels = await listNovels(session.user.id);
    if (novels.length > 0) {
      const novelIds = novels.map((n) => n.id);
      const [progress, bookmarks, chapterVisits, continueReadingResult] = await Promise.all([
        getReadingProgressBatch(session.user.id, novelIds),
        getBookmarkCountsBatch(session.user.id, novelIds),
        getChapterVisitsForAnalytics(session.user.id, novels),
        getContinueReadingNovel(session.user.id),
      ]);
      progressMap = progress;
      bookmarkCountMap = bookmarks;
      if (chapterVisits.length > 0) {
        analytics = computeReadingAnalytics(chapterVisits);
        dailyActivity = computeDailyActivity(chapterVisits);
      }
      if (continueReadingResult) {
        continueReading = {
          ...continueReadingResult,
          lastReadAt: continueReadingResult.lastReadAt.toISOString(),
        };
      }
    }
  } catch {
    error = "Failed to load novels. Please ensure the database is configured.";
  }

  const progressData: Record<string, NovelProgressData> = {};
  for (const [novelId, prog] of progressMap) {
    progressData[novelId] = {
      lastChapterIndex: prog.lastChapterIndex,
      totalChapters: novels.find((n) => n.id === novelId)?.chapterCount ?? 0,
      totalVisited: prog.totalVisited,
      lastReadAt: prog.updatedAt.toISOString(),
    };
  }

  const bookmarkCounts: Record<string, number> = {};
  for (const [novelId, count] of bookmarkCountMap) {
    bookmarkCounts[novelId] = count;
  }

  return (
    <LibraryShelf
      activeRoute="dashboard"
      user={session.user}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Add to your library
        </h2>
        <div className="bg-card rounded-lg border border-border p-6">
          <UploadForm />
        </div>
      </section>
      {continueReading && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
            Pick up where you left off
          </h2>
          <ContinueReadingBanner continueReading={continueReading} />
        </section>
      )}
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
          <>
            <ReadingStatsBanner
              totalNovels={novels.length}
              progressData={progressData}
              bookmarkCounts={bookmarkCounts}
              analytics={analytics}
            />
            <ActivityHeatmap dailyActivity={dailyActivity} />
            <NovelLibrary novels={novels} progressData={progressData} bookmarkCounts={bookmarkCounts} />
          </>
        )}
      </section>
    </LibraryShelf>
  );
}
