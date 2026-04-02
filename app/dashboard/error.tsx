"use client";

import ErrorBoundaryPage from "@/app/components/error-boundary-page";

/**
 * Error boundary for the dashboard/library route.
 *
 * Catches server-side failures (e.g. listNovels DB error) and
 * renders a contextual recovery UI within the root layout.
 */
export default function DashboardError({
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
      title="Couldn't load your library"
      description="We had trouble loading your novels. This is usually temporary — try refreshing the page."
      backLabel="Home"
      backHref="/"
      logLabel="DashboardError"
    />
  );
}
