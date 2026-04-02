"use client";

import ErrorBoundaryPage from "@/app/components/error-boundary-page";

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
  return (
    <ErrorBoundaryPage
      error={error}
      reset={reset}
      title="Couldn't load this novel"
      description="Something went wrong while loading the novel details. The file may be temporarily unavailable."
      backLabel="Back to library"
      backHref="/dashboard"
      logLabel="NovelDetailError"
    />
  );
}
