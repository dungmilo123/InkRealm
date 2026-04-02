"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary for the novel detail route.
 *
 * Catches failures from the multiple parallel data fetches
 * (novel data, reader summary, translation status, etc.)
 * and offers navigation back to the library.
 */
export default function NovelDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[NovelDetailError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-destructive"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Couldn&apos;t load this novel
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Something went wrong while loading the novel details.
          The file may be temporarily unavailable.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center rounded-full bg-foreground text-background px-6 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Back to library
          </Link>
        </div>
      </div>
    </div>
  );
}
