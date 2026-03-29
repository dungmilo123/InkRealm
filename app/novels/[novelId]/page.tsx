import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNovelByIdOrNotFound } from "@/app/lib/novels";
import { getReaderSummary } from "@/app/lib/reader";
import { listTranslationProfilesForDisplay } from "@/app/lib/translation/profiles";
import { listNovelTranslationJobViews } from "@/app/lib/translation/service";
import { getReadingProgress } from "@/app/lib/reading-progress";
import {
  NovelDetailsView,
  type SerializedTranslationJob,
  type SerializedTranslationProfile,
} from "./novel-details-view";

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
  const [readerSummary, readingProgress] = await Promise.all([
    getReaderSummary(novel),
    getReadingProgress(session.user.id, novel.id),
  ]);

  let translationProfiles: Awaited<
    ReturnType<typeof listTranslationProfilesForDisplay>
  > = [];
  let translationJobs: Awaited<ReturnType<typeof listNovelTranslationJobViews>> = [];
  let translationDataError: string | null = null;

  try {
    [translationProfiles, translationJobs] = await Promise.all([
      listTranslationProfilesForDisplay(session.user.id),
      listNovelTranslationJobViews(novel.id, session.user.id),
    ]);
  } catch {
    translationDataError = "Translation data is currently unavailable.";
  }

  const serializedProfiles: SerializedTranslationProfile[] = translationProfiles.map((profile) => ({
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }));

  const serializedJobs: SerializedTranslationJob[] = translationJobs.map((job) => ({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }));

  return (
    <NovelDetailsView
      novel={novel}
      readerSummary={readerSummary}
      readingProgress={readingProgress}
      translationDataError={translationDataError}
      serializedProfiles={serializedProfiles}
      serializedJobs={serializedJobs}
    />
  );
}
