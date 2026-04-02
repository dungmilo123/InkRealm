"use client";

import ErrorBoundaryPage from "@/app/components/error-boundary-page";

/**
 * Error boundary for the settings route.
 *
 * Catches failures from loading user profile data or
 * translation profile list. Offers retry and fallback
 * navigation to the library.
 */
export default function SettingsError({
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
      title="Couldn't load settings"
      description="We had trouble loading your account settings. This is usually temporary — try refreshing."
      backLabel="Back to library"
      backHref="/dashboard"
      logLabel="SettingsError"
    />
  );
}
