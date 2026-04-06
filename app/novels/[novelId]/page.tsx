import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNovelByIdOrNotFound, cachedGetNovelById } from "@/app/lib/novels";
import { getReaderSummary } from "@/app/lib/reader";
import { getDefaultProfile } from "@/app/lib/translation/profiles";
import { getLatestNovelTranslationJobView, getInitialChapterStatuses } from "@/app/lib/translation/service";
import { countNovelTranslatedChapters } from "@/app/lib/translation/data";
import { getReadingProgress } from "@/app/lib/reading-progress";
import { getNovelChapterVisitsForStats } from "@/app/lib/reading-stats-data";
import { computeNovelReadingStats } from "@/lib/reading-stats";
import {
  NovelDetailsView,
  type SerializedTranslationJob,
  type ChapterTranslationStatus,
} from "./novel-details-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ novelId: string }>;
}): Promise<Metadata> {
  const { novelId } = await params;
  const novel = await cachedGetNovelById(novelId);

  if (!novel) {
    return { title: "Novel Not Found" };
  }

  return {
    title: novel.title,
    description: `Read "${novel.title}" — ${novel.fileType.toUpperCase()} novel on InkRealm`,
  };
}

export default async function NovelDetailsPage({
  params,
}: {
  params: Promise<{ novelId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { novelId } = await params;
  const novel = await getNovelByIdOrNotFound(novelId, session.user.id);
  const [readerSummary, readingProgress, chapterVisits] = await Promise.all([
    getReaderSummary(novel),
    getReadingProgress(session.user.id, novel.id),
    getNovelChapterVisitsForStats(session.user.id, novel),
  ]);

  const novelReadingStats = chapterVisits.length > 0
    ? computeNovelReadingStats(chapterVisits)
    : null;

  let defaultProfile: Awaited<ReturnType<typeof getDefaultProfile>> = null;
  let latestJob: Awaited<ReturnType<typeof getLatestNovelTranslationJobView>> = null;
  let initialChapterStatuses: ChapterTranslationStatus[] = [];
  let translatedChapterCount = 0;
  let translationDataError: string | null = null;

  try {
    const [dp, lj, ics, tcc] = await Promise.all([
      getDefaultProfile(session.user.id),
      getLatestNovelTranslationJobView(novel.id, session.user.id),
      getInitialChapterStatuses(novel.id, session.user.id),
      countNovelTranslatedChapters(novel.id),
    ]);
    defaultProfile = dp;
    latestJob = lj;
    initialChapterStatuses = ics;
    translatedChapterCount = tcc;
  } catch {
    translationDataError = "Translation data is currently unavailable.";
  }

  const serializedDefaultProfile = defaultProfile
    ? {
        id: defaultProfile.id,
        provider: defaultProfile.provider,
        model: defaultProfile.model,
        createdAt: defaultProfile.createdAt.toISOString(),
        updatedAt: defaultProfile.updatedAt.toISOString(),
      }
    : null;

  const serializedLatestJob: SerializedTranslationJob | null = latestJob
    ? {
        ...latestJob,
        createdAt: latestJob.createdAt.toISOString(),
        updatedAt: latestJob.updatedAt.toISOString(),
      }
    : null;

  return (
    <NovelDetailsView
      novel={novel}
      readerSummary={readerSummary}
      readingProgress={readingProgress}
      novelReadingStats={novelReadingStats}
      translationDataError={translationDataError}
      serializedDefaultProfile={serializedDefaultProfile}
      serializedLatestJob={serializedLatestJob}
      chapterCount={readerSummary.chapterCount}
      initialChapterStatuses={initialChapterStatuses}
      translatedChapterCount={translatedChapterCount}
    />
  );
}
