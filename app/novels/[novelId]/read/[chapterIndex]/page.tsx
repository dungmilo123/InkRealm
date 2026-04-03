import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getNovelByIdOrNotFound, cachedGetNovelById } from "@/app/lib/novels";
import {
  getReaderChapter,
  InvalidChapterIndexError,
  ReaderUnavailableError,
} from "@/app/lib/reader";
import {
  recordChapterVisit,
  getReadingProgress,
  getScrollPosition,
} from "@/app/lib/reading-progress";
import { getUserReadingPreferences } from "@/app/lib/reading-preferences";
import { getTranslatedChapterForReader } from "@/app/lib/translation/service";
import {
  isChapterBookmarked,
  getBookmarkedChapterIndices,
} from "@/app/lib/bookmarks";
import { countWordsInParagraphs } from "@/lib/reading-time";
import { ReaderClient } from "./reader-client";

function parseChapterIndex(value: string): number {
  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ novelId: string; chapterIndex: string }>;
}): Promise<Metadata> {
  const { novelId, chapterIndex: chapterIndexParam } = await params;
  const novel = await cachedGetNovelById(novelId);
  const chapterIndex = parseChapterIndex(chapterIndexParam);

  if (!novel || !Number.isInteger(chapterIndex) || chapterIndex <= 0) {
    return { title: "Reader" };
  }

  return {
    title: `Chapter ${chapterIndex} — ${novel.title}`,
    description: `Reading chapter ${chapterIndex} of "${novel.title}" on InkRealm`,
  };
}

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

  const [preferences, translatedChapter, bookmarked, bookmarkedIndices, readingProgress, serverScrollPosition] =
    await Promise.all([
      getUserReadingPreferences(session.user.id),
      getTranslatedChapterForReader(novel.id, chapterIndex, session.user.id),
      isChapterBookmarked(session.user.id, novel.id, chapterIndex),
      getBookmarkedChapterIndices(session.user.id, novel.id),
      getReadingProgress(session.user.id, novel.id),
      getScrollPosition(session.user.id, novel.id, chapterIndex),
    ]);
  const { document, chapter } = chapterData;
  const wordCount = countWordsInParagraphs(chapter.paragraphs);
  const chapterTitles = document.chapters.map((ch) => ({
    index: ch.index,
    title: ch.title,
    wordCount: countWordsInParagraphs(ch.paragraphs),
  }));

  return (
    <ReaderClient
      novelId={novel.id}
      novelTitle={novel.title}
      chapter={{
        index: chapter.index,
        title: chapter.title,
        paragraphs: chapter.paragraphs,
      }}
      chapters={chapterTitles}
      chapterCount={document.chapterCount}
      wordCount={wordCount}
      preferences={preferences}
      user={session.user}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
      translatedParagraphs={translatedChapter?.translatedParagraphs ?? null}
      initialBookmarked={bookmarked}
      bookmarkedChapterIndices={[...bookmarkedIndices]}
      visitedChapterIndices={readingProgress?.visitedChapterIndices ?? []}
      initialScrollPosition={serverScrollPosition}
    />
  );
}
