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
import { ReaderClient } from "./reader-client";

function parseChapterIndex(value: string): number {
  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number(value);
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
  void recordChapterVisit(session.user.id, novelId, chapterIndex);

  const preferences = await getUserReadingPreferences(session.user.id);
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
    />
  );
}
