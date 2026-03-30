import Link from "next/link";

export default function NovelNotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Novel not available
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The requested novel or chapter could not be found, or this file cannot be read in
          the in-app reader.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-full bg-foreground text-background px-6 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Back to library
          </Link>
        </div>
      </div>
    </div>
  );
}
