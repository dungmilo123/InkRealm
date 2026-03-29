import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { getNovelByIdOrNotFound } from "@/app/lib/novels";
import {
  getReaderChapter,
  InvalidChapterIndexError,
  ReaderUnavailableError,
} from "@/app/lib/reader";
import { GlossaryReader } from "./glossary-reader";

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

  const { document, chapter } = chapterData;

  const previousChapterHref =
    chapter.index > 1 ? `/novels/${novel.id}/read/${chapter.index - 1}` : null;
  const nextChapterHref =
    chapter.index < document.chapterCount
      ? `/novels/${novel.id}/read/${chapter.index + 1}`
      : null;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm mb-3">
            <div className="flex items-center gap-x-4">
              <Link
                href={`/novels/${novel.id}`}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Novel details
              </Link>
              <Link
                href="/dashboard"
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Library
              </Link>
            </div>
            {session.user && (
              <UserMenu
                user={session.user}
                signOutAction={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              />
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {chapter.title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {novel.title} · Chapter {chapter.index} of {document.chapterCount}
          </p>
        </div>
      </header>

      <main className="w-full max-w-3xl mx-auto px-8 py-8">
        <GlossaryReader novelId={novel.id} paragraphs={chapter.paragraphs} />

        <nav className="mt-6 flex items-center justify-between gap-4">
          {previousChapterHref ? (
            <Link
              href={previousChapterHref}
              className="inline-flex h-10 items-center rounded-full border border-zinc-300 dark:border-zinc-700 px-5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Previous chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-5 text-sm text-zinc-400 dark:text-zinc-500">
              Start of novel
            </span>
          )}

          {nextChapterHref ? (
            <Link
              href={nextChapterHref}
              className="inline-flex h-10 items-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Next chapter
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-5 text-sm text-zinc-400 dark:text-zinc-500">
              End of novel
            </span>
          )}
        </nav>
      </main>
    </div>
  );
}
