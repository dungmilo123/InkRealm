export default function ReaderLoading() {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
            <div className="flex items-center gap-x-4">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="flex items-center gap-x-3">
              <div className="h-8 w-16 rounded-md bg-muted animate-pulse" />
              <div className="size-8 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
          <div className="h-7 w-80 rounded bg-muted animate-pulse" />
          <div className="h-4 w-48 rounded bg-muted animate-pulse mt-2" />
        </div>
      </header>
      <main className="w-full mx-auto px-8 py-8" style={{ maxWidth: "720px" }}>
        <div className="space-y-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-muted animate-pulse"
              style={{ width: `${75 + (i * 7) % 25}%` }}
            />
          ))}
        </div>
        <nav className="mt-6 flex items-center justify-between gap-4">
          <div className="h-10 w-40 rounded-full bg-muted animate-pulse" />
          <div className="h-10 w-36 rounded-full bg-muted animate-pulse" />
        </nav>
      </main>
    </div>
  );
}
