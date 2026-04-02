export default function SettingsLoading() {
  return (
    <div className="flex min-h-screen justify-center bg-background" aria-busy="true" aria-label="Loading settings">
      <div className="w-full max-w-2xl space-y-6 px-6 py-12">
        <div>
          <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-8 w-28 rounded bg-muted motion-safe:animate-pulse mt-4" />
        </div>
        <div className="flex gap-2 border-b border-border pb-1">
          <div className="h-9 w-24 rounded bg-muted/50 motion-safe:animate-pulse" />
          <div className="h-9 w-40 rounded bg-muted/50 motion-safe:animate-pulse" />
        </div>
        <div className="space-y-6 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div>
                <div className="h-5 w-28 rounded bg-muted motion-safe:animate-pulse" />
                <div className="h-3 w-48 rounded bg-muted motion-safe:animate-pulse mt-2" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="h-10 w-full rounded-md bg-muted motion-safe:animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
