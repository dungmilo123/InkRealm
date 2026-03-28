import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background">
      <main className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center py-24 px-8">
        <div className="flex flex-col items-center gap-10 text-center">
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="flex -space-x-2">
                <div
                  className="size-12 rounded-lg rotate-[-8deg]"
                  style={{ backgroundColor: "oklch(0.45 0.12 25)" }}
                />
                <div
                  className="size-12 rounded-lg rotate-[4deg] translate-x-2"
                  style={{ backgroundColor: "oklch(0.4 0.1 180)" }}
                />
                <div
                  className="size-12 rounded-lg rotate-[12deg] translate-x-4"
                  style={{ backgroundColor: "oklch(0.5 0.1 130)" }}
                />
              </div>
            </div>
            <h1 className="text-4xl font-heading font-semibold tracking-tight text-foreground">
              Your Library
            </h1>
            <p className="text-base leading-7 text-muted-foreground max-w-sm">
              A personal space for your novels. Upload .txt and .epub files and read them anytime.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open Library
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </main>
      <footer className="w-full py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Built for readers
        </p>
      </footer>
    </div>
  );
}
