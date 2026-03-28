import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center py-32 px-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Novel Dashboard
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-md">
            Upload and manage your novel library. Support for .txt and .epub files.
          </p>
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-black px-8 text-background transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Open Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
