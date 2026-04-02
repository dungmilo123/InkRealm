export default function DashboardLoading() {
  return (
    <div className="flex flex-col flex-1 bg-background" aria-busy="true" aria-label="Loading your library">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="h-7 w-28 rounded bg-muted motion-safe:animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted motion-safe:animate-pulse hidden sm:block" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        <section className="mb-10">
          <div className="h-4 w-36 rounded bg-muted motion-safe:animate-pulse mb-4" />
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-10 flex-1 rounded-lg bg-muted motion-safe:animate-pulse" />
              <div className="h-10 w-32 rounded-lg bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        </section>
        <section>
          <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="w-full aspect-[2/3] rounded-md bg-muted motion-safe:animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
