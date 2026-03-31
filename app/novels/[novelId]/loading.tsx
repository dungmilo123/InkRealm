export default function NovelDetailsLoading() {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="w-[140px] h-[210px] rounded-md bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-7 w-64 rounded bg-muted animate-pulse" />
                <div className="h-4 w-40 rounded bg-muted animate-pulse mt-2" />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 w-12 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-24 rounded bg-muted animate-pulse mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <div className="h-4 w-72 rounded bg-muted animate-pulse mb-3" />
            <div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />
          </div>
          <div>
            <div className="flex border-b border-border gap-1">
              {["Chapters", "Translation", "Glossary"].map((tab) => (
                <div key={tab} className="h-10 w-24 rounded-t bg-muted/50 animate-pulse" />
              ))}
            </div>
            <div className="pt-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="size-5 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-8 rounded bg-muted animate-pulse" />
                  <div className="h-4 flex-1 rounded bg-muted animate-pulse" style={{ maxWidth: `${60 + (i % 3) * 15}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
