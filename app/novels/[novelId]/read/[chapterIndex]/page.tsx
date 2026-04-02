import { notFound } from "next/navigation";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getNovelByIdOrNotFound } from "@/app/lib/novels";
import {
  getReaderChapter,
  InvalidChapterIndexError,
  ReaderUnavailableError,
} from "@/app/lib/reader";
import { recordChapterVisit } from "@/app/lib/reading-progress";
import { getUserReadingPreferences } from "@/app/lib/reading-preferences";
import { getTranslatedChapterForReader } from "@/app/lib/translation/service";
import { ReaderClient } from "./reader-client";

function parseChapterIndex(value: string): number {
  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

/**
 * Render the reader page for a specific novel chapter, handling authentication, parameter validation, data loading, and recording reading progress.
 *
 * If the user is unauthenticated this route redirects to "/login". If the chapter index is invalid or the requested chapter is unavailable, the handler triggers a not-found response. The function records the chapter visit as a fire-and-forget side effect and concurrently loads the user's reading preferences and any available translated paragraphs before rendering the reader UI.
 *
 * @param params - A promise that resolves to route parameters containing `novelId` and `chapterIndex` as strings.
 * @returns The JSX element for the chapter reader populated with novel metadata, chapter content, user preferences, and translated paragraphs when available.
 */
export default async function ReaderChapterPage({
  params,
}: {
  params: Promise<{ novelId: string; chapterIndex: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { novelId, chapterIndex: chapterIndexParam } = await params;
  const chapterIndex = parseChapterIndex(chapterIndexParam);

  if (!Number.isInteger(chapterIndex) || chapterIndex <= 0) {
    notFound();
  }

  const novel = await getNovelByIdOrNotFound(novelId, session.user.id);
  let chapterData: Awaited<ReturnType<typeof getReaderChapter>>;

  try {
    chapterData = await getReaderChapter(novel, chapterIndex);
  } catch (error) {
    if (
      error instanceof InvalidChapterIndexError ||
      error instanceof ReaderUnavailableError
    ) {
      notFound();
    }

    throw error;
  }

  // Fire-and-forget: record chapter visit for reading progress
  recordChapterVisit(session.user.id, novelId, chapterIndex).catch((err) =>
    console.error("Failed to record chapter visit:", err)
  );

  const [preferences, translatedChapter] = await Promise.all([
    getUserReadingPreferences(session.user.id),
    getTranslatedChapterForReader(novel.id, chapterIndex, session.user.id),
  ]);
  const { document, chapter } = chapterData;

  return (
    <ReaderClient
      novelId={novel.id}
      novelTitle={novel.title}
      chapter={{
        index: chapter.index,
        title: chapter.title,
        paragraphs: chapter.paragraphs,
      }}
      chapterCount={document.chapterCount}
      preferences={preferences}
      user={session.user}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
      translatedParagraphs={translatedChapter?.translatedParagraphs ?? null}
    />
  );
}
