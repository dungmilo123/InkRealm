"use client";

import ErrorBoundaryPage from "@/app/components/error-boundary-page";

/**
 * General error boundary for all routes.
 *
 * Renders inside the root layout, so it has access to theme tokens,
 * fonts, and the ThemeProvider. Catches runtime errors from any
 * page or layout below the root.
 */
export default function ErrorPage({
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
      title="Something went wrong"
      description="An unexpected error occurred while loading this page. You can try again, or return to your library."
      backLabel="Back to library"
      backHref="/dashboard"
      logLabel="ErrorBoundary"
    />
  );
}
